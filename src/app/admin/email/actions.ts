'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isOwner } from '@/lib/auth/roles'
import { sendBroadcast } from '@/lib/email/broadcast'

async function assertAdmin(): Promise<{ adminId: string } | { error: string }> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || !isOwner((profile as { role?: string }).role)) {
    return { error: 'Owners only' }
  }
  return { adminId: user.id }
}

const previewSchema = z.object({
  audience: z.enum(['active-members']),
})

export interface PreviewResult {
  ok: true
  total: number
  sample: { email: string; fullName: string | null }[]
  skippedOptedOut: number
}

export async function previewAudience(
  input: z.infer<typeof previewSchema>
): Promise<PreviewResult | { ok: false; error: string }> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = previewSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid audience' }
  }

  const admin = createAdminClient()

  let recipients: { email: string; fullName: string | null }[] = []
  if (data.audience === 'active-members') {
    const { data: rows } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('archived', false)
      .not('email', 'is', null)
      .order('created_at', { ascending: true })
    recipients = ((rows as Record<string, unknown>[] | null) ?? []).map(
      (r) => ({
        email: r.email as string,
        fullName: (r.full_name as string | null) ?? null,
      })
    )
  }

  if (recipients.length === 0) {
    return {
      ok: true,
      total: 0,
      sample: [],
      skippedOptedOut: 0,
    }
  }

  const { data: optedOutRows } = await admin
    .from('unsubscribes')
    .select('email')
    .in(
      'email',
      recipients.map((r) => r.email.toLowerCase())
    )
  const optedOut = new Set(
    ((optedOutRows as Array<{ email: string }> | null) ?? []).map((r) =>
      r.email.toLowerCase()
    )
  )
  const final = recipients.filter((r) => !optedOut.has(r.email.toLowerCase()))

  return {
    ok: true,
    total: final.length,
    sample: final.slice(0, 5),
    skippedOptedOut: recipients.length - final.length,
  }
}

const sendSchema = z.object({
  audience: z.enum(['active-members']),
  subject: z.string().min(1).max(200),
  bodyMarkdown: z.string().min(1).max(20000),
  // Must equal the audience size the admin saw in preview, to prevent
  // surprise expansion. We don't strictly enforce it — just used as a
  // confirmation marker.
  expectedRecipientCount: z.number().int().min(1).max(10000),
})

export type SendBroadcastResult =
  | { ok: true; sent: number; failed: number; skipped: number }
  | { ok: false; error: string }

export async function sendBroadcastAction(
  input: z.infer<typeof sendSchema>
): Promise<SendBroadcastResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = sendSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()

  // Pull recipients (same query as preview).
  const { data: rows } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .eq('archived', false)
    .not('email', 'is', null)
    .order('created_at', { ascending: true })

  const recipients = ((rows as Record<string, unknown>[] | null) ?? []).map(
    (r) => ({
      userId: r.id as string,
      email: r.email as string,
      fullName: (r.full_name as string | null) ?? null,
    })
  )

  if (recipients.length === 0) {
    return { ok: false, error: 'No recipients matched the audience' }
  }

  // Use subject as the dedup template id. Same subject sent twice would
  // skip already-sent recipients.
  const result = await sendBroadcast({
    admin,
    input: {
      subject: data.subject,
      bodyMarkdown: data.bodyMarkdown,
      recipients,
      template: `broadcast:${data.subject}`,
    },
  })

  revalidatePath('/admin/email')
  return {
    ok: true,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
  }
}
