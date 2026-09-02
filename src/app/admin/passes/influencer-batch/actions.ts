'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { astEndOfDay } from '@/lib/time/ast'

// =====================================================================
// Bulk-issue Influencer 5-Day Pass to a list of recipients.
//
// Each recipient is referenced by email. We look up the matching
// profile (case-insensitive). For each match:
//   - Insert a $0 payments row tagged 'cash' with metadata.kind =
//     'influencer_program' and recorded_by = current admin
//   - Insert a pass_purchases row for 'influencer-5-day-pass' with
//     5 uses and expires_at hard-set to the campaign date
//   - Skip if the recipient already has an unexpired influencer pass
//     (idempotent)
//
// Emails with no matching profile are returned in the result so the
// admin can re-issue after the recipient signs up.
// =====================================================================

const PASS_ID = 'influencer-5-day-pass'

const formSchema = z.object({
  // ISO date string, e.g. '2026-06-06'
  expiresAtIso: z.string().min(10),
  emails: z.array(z.string().email()).min(1).max(50),
  note: z.string().max(500).optional(),
})

export type InfluencerBatchOutcome =
  | 'granted'
  | 'already_has_active_pass'
  | 'no_profile'
  | 'payment_insert_failed'
  | 'pass_insert_failed'

export interface InfluencerBatchResult {
  ok: boolean
  error?: string
  perEmail: Array<{
    email: string
    outcome: InfluencerBatchOutcome
    paymentId?: string
    passPurchaseId?: string
    note?: string
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

export async function issueInfluencerPassBatch(
  input: z.infer<typeof formSchema>
): Promise<InfluencerBatchResult> {
  const auth = await assertAdmin()
  if ('error' in auth) {
    return { ok: false, error: auth.error, perEmail: [] }
  }

  let data
  try {
    data = formSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg, perEmail: [] }
  }

  // Validate the date. Use AST end-of-day so an admin who picks
  // 2026-06-06 means "all day Jun 6 in Trinidad", not 8pm AST.
  if (Number.isNaN(new Date(data.expiresAtIso).getTime())) {
    return { ok: false, error: 'Invalid expiry date', perEmail: [] }
  }
  const expiresAt = astEndOfDay(data.expiresAtIso)

  const admin = createAdminClient()

  // Verify the catalog pass exists; we use its uses_total so the row
  // shape matches the rest of the system.
  const { data: pass } = await admin
    .from('passes')
    .select('uses_total')
    .eq('id', PASS_ID)
    .maybeSingle()
  if (!pass) {
    return {
      ok: false,
      error: `Catalog row '${PASS_ID}' not found. Re-run the migration.`,
      perEmail: [],
    }
  }
  const usesTotal = (pass as { uses_total: number }).uses_total

  // Look up all emails in one shot. Postgres .in() is case-sensitive on
  // text columns so we lowercase both sides.
  const normalized = data.emails.map((e) => e.toLowerCase().trim())
  const { data: profilesRaw } = await admin
    .from('profiles')
    .select('id, email, archived')
    .in('email', normalized)
  const profiles =
    (profilesRaw as Array<{
      id: string
      email: string
      archived: boolean
    }> | null) ?? []
  const profileByEmail = new Map(
    profiles.map((p) => [p.email.toLowerCase(), p])
  )

  const perEmail: InfluencerBatchResult['perEmail'] = []

  for (const email of normalized) {
    const profile = profileByEmail.get(email)
    if (!profile) {
      perEmail.push({ email, outcome: 'no_profile' })
      continue
    }
    if (profile.archived) {
      perEmail.push({
        email,
        outcome: 'no_profile',
        note: 'Profile is archived',
      })
      continue
    }

    // Idempotency: skip if this member already has an active
    // influencer pass with uses remaining and an expiry in the future.
    const { data: existing } = await admin
      .from('pass_purchases')
      .select('id')
      .eq('user_id', profile.id)
      .eq('pass_id', PASS_ID)
      .gt('uses_remaining', 0)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle()
    if (existing) {
      perEmail.push({
        email,
        outcome: 'already_has_active_pass',
        passPurchaseId: (existing as { id: string }).id,
      })
      continue
    }

    // 1) Insert the $0 payment first so the grant is anchored to an
    //    auditable record.
    const { data: paymentRow, error: payErr } = await admin
      .from('payments')
      .insert({
        user_id: profile.id,
        amount_cents: 0,
        currency: 'TTD',
        status: 'succeeded',
        kind: 'pass',
        payment_method: 'other',
        recorded_by: auth.adminId,
        paid_at: new Date().toISOString(),
        metadata: {
          manual: true,
          program: 'influencer_program',
          passId: PASS_ID,
          campaignExpiresAt: data.expiresAtIso,
          note: data.note ?? null,
        },
      })
      .select('id')
      .single()
    if (payErr || !paymentRow) {
      console.error('[influencer-batch] payment insert failed:', payErr)
      perEmail.push({
        email,
        outcome: 'payment_insert_failed',
        note: payErr?.message,
      })
      continue
    }
    const paymentId = (paymentRow as { id: string }).id

    // 2) Mint the pass with the campaign-specific expiry.
    const { data: passRow, error: passErr } = await admin
      .from('pass_purchases')
      .insert({
        user_id: profile.id,
        pass_id: PASS_ID,
        uses_total: usesTotal,
        uses_remaining: usesTotal,
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single()
    if (passErr || !passRow) {
      console.error('[influencer-batch] pass insert failed:', passErr)
      perEmail.push({
        email,
        outcome: 'pass_insert_failed',
        paymentId,
        note: passErr?.message,
      })
      continue
    }

    perEmail.push({
      email,
      outcome: 'granted',
      paymentId,
      passPurchaseId: (passRow as { id: string }).id,
    })
  }

  revalidatePath('/admin/payments')
  revalidatePath('/admin')

  return { ok: true, perEmail }
}
