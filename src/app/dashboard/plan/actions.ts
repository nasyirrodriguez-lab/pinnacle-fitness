'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendMessageFromMember } from '@/lib/notifications/notify'

const requestSchema = z.object({
  kind: z.enum(['pause', 'deactivate', 'reactivate']),
  note: z.string().trim().max(1000).optional().nullable(),
})

const KIND_LABEL: Record<string, string> = {
  pause: 'Pause membership',
  deactivate: 'Deactivate membership',
  reactivate: 'Reactivate membership',
}

export type PlanRequestResult = { ok: true } | { ok: false; error: string }

export async function requestPlanChange(
  input: z.infer<typeof requestSchema>
): Promise<PlanRequestResult> {
  let data
  try {
    data = requestSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid request' }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in first' }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('member_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('kind', data.kind)
    .eq('status', 'open')
    .limit(1)
  if (existing && existing.length > 0) {
    return {
      ok: false,
      error: `You already have a ${data.kind} request open — the team will be in touch.`,
    }
  }

  const { error: insertErr } = await admin.from('member_requests').insert({
    user_id: user.id,
    kind: data.kind,
    note: data.note?.trim() || null,
  })
  if (insertErr) {
    console.error('[plan/request] insert failed:', insertErr)
    return { ok: false, error: 'Could not send your request — try again' }
  }

  // Also lands in the admin Messages inbox so it can't be missed.
  await sendMessageFromMember(admin, {
    userId: user.id,
    body: `[Plan request] ${KIND_LABEL[data.kind]}${
      data.note?.trim() ? ` — ${data.note.trim()}` : ''
    }`,
  })

  revalidatePath('/dashboard/plan')
  revalidatePath('/admin/notifications')
  return { ok: true }
}
