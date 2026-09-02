'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { issueCreditGrant } from '@/lib/credits/balance'
import { astEndOfDay } from '@/lib/time/ast'

// =====================================================================
// Bulk-issue credits to a list of recipients. Each line is parsed as
// `email,amountTtd[,note]`. Profile-match attaches immediately; no
// match falls back to email-keyed unclaimed grant.
// =====================================================================

const rowSchema = z.object({
  email: z.string().email(),
  amountTtd: z.number().positive(),
  note: z.string().optional(),
})

const formSchema = z.object({
  expiresAtIso: z.string().min(10),
  reason: z.enum([
    'closure_compensation',
    'refund_as_credit',
    'goodwill',
    'referral',
    'other',
  ]),
  rows: z.array(rowSchema).min(1).max(100),
})

export type IssueOutcome = 'attached' | 'unclaimed' | 'failed'

export interface IssueResult {
  ok: boolean
  error?: string
  perRow: Array<{
    email: string
    amountTtd: number
    outcome: IssueOutcome
    note?: string
    grantId?: string
  }>
}

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
  if (!profile || (profile as { role?: string }).role !== 'admin') {
    return { error: 'Admin only' }
  }
  return { adminId: user.id }
}

export async function issueCreditBatch(
  input: z.infer<typeof formSchema>
): Promise<IssueResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error, perRow: [] }

  let data
  try {
    data = formSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg, perRow: [] }
  }

  // End-of-day in AST so a credit dated 2026-08-22 is usable all day in
  // Trinidad, not just until 8pm.
  if (Number.isNaN(new Date(data.expiresAtIso).getTime())) {
    return { ok: false, error: 'Invalid expiry date', perRow: [] }
  }
  const expiresAt = astEndOfDay(data.expiresAtIso)

  const admin = createAdminClient()
  const perRow: IssueResult['perRow'] = []

  for (const row of data.rows) {
    const amountCents = Math.round(row.amountTtd * 100)
    const result = await issueCreditGrant(admin, {
      userId: null,
      recipientEmail: row.email,
      amountCents,
      reason: data.reason,
      reasonNote: row.note ?? null,
      expiresAt,
      issuedBy: auth.adminId,
    })
    if (!result.ok) {
      perRow.push({
        email: row.email,
        amountTtd: row.amountTtd,
        outcome: 'failed',
        note: result.error,
      })
      continue
    }
    perRow.push({
      email: row.email,
      amountTtd: row.amountTtd,
      outcome: result.attached ? 'attached' : 'unclaimed',
      grantId: result.grantId,
    })
  }

  revalidatePath('/admin/credits')
  revalidatePath('/admin')

  return { ok: true, perRow }
}
