import type { SupabaseClient } from '@supabase/supabase-js'

// =====================================================================
// Account-credit helpers. The balance is materialized via the
// credit_ledger.balance_after_cents column; reading the most recent row
// gives us the current balance in O(1). Writes always read-then-insert
// (no race-free guarantee at high concurrency, but our redemption rate
// is admin-paced so it's fine).
// =====================================================================

export async function getCreditBalanceCents(
  admin: SupabaseClient,
  userId: string
): Promise<number> {
  const { data } = await admin
    .from('credit_ledger')
    .select('balance_after_cents')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (
    (data as { balance_after_cents?: number } | null)?.balance_after_cents ?? 0
  )
}

interface GrantArgs {
  userId: string | null
  recipientEmail: string | null
  amountCents: number
  reason:
    | 'closure_compensation'
    | 'refund_as_credit'
    | 'goodwill'
    | 'referral'
    | 'other'
  reasonNote?: string | null
  expiresAt: Date
  issuedBy: string
}

export interface GrantResult {
  ok: boolean
  error?: string
  grantId?: string
  attached: boolean
  balanceAfterCents?: number
}

export async function issueCreditGrant(
  admin: SupabaseClient,
  args: GrantArgs
): Promise<GrantResult> {
  if (args.amountCents <= 0) {
    return { ok: false, error: 'Credit must be positive', attached: false }
  }

  // If user_id is missing but we have an email, see if a profile exists.
  let userId = args.userId
  if (!userId && args.recipientEmail) {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', args.recipientEmail)
      .maybeSingle()
    if (data) userId = (data as { id: string }).id
  }
  if (!userId && !args.recipientEmail) {
    return {
      ok: false,
      error: 'Either userId or recipientEmail is required',
      attached: false,
    }
  }

  // Insert the grant.
  const { data: grantRow, error: grantErr } = await admin
    .from('credit_grants')
    .insert({
      user_id: userId,
      recipient_email: args.recipientEmail
        ? args.recipientEmail.toLowerCase()
        : null,
      amount_cents: args.amountCents,
      reason: args.reason,
      reason_note: args.reasonNote ?? null,
      expires_at: args.expiresAt.toISOString(),
      issued_by: args.issuedBy,
      attached_at: userId ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (grantErr || !grantRow) {
    return { ok: false, error: grantErr?.message, attached: false }
  }
  const grantId = (grantRow as { id: string }).id

  // If we have a user_id, immediately write a ledger entry so the
  // member sees their balance go up.
  if (userId) {
    const current = await getCreditBalanceCents(admin, userId)
    const balanceAfter = current + args.amountCents
    const { error: ledgerErr } = await admin.from('credit_ledger').insert({
      user_id: userId,
      grant_id: grantId,
      amount_cents: args.amountCents,
      balance_after_cents: balanceAfter,
      reason: args.reasonNote ?? `Credit: ${args.reason}`,
    })
    if (ledgerErr) {
      return { ok: false, error: ledgerErr.message, attached: false, grantId }
    }
    return {
      ok: true,
      grantId,
      attached: true,
      balanceAfterCents: balanceAfter,
    }
  }

  // Unclaimed: lives in credit_grants until the trigger attaches it on signup.
  return { ok: true, grantId, attached: false }
}

export interface ApplyResult {
  ok: boolean
  error?: string
  appliedCents: number
  balanceAfterCents: number
}

// Try to apply up to `requestedCents` of the user's credit to a payment.
// Returns how much was actually applied (could be less than requested if
// the balance is short).
export async function applyCreditToPayment(
  admin: SupabaseClient,
  args: {
    userId: string
    paymentId: string
    requestedCents: number
    reason?: string
  }
): Promise<ApplyResult> {
  const current = await getCreditBalanceCents(admin, args.userId)
  const applied = Math.min(current, args.requestedCents)
  if (applied <= 0) {
    return { ok: true, appliedCents: 0, balanceAfterCents: current }
  }
  const balanceAfter = current - applied
  const { error } = await admin.from('credit_ledger').insert({
    user_id: args.userId,
    amount_cents: -applied,
    balance_after_cents: balanceAfter,
    reason: args.reason ?? 'Applied to purchase',
    payment_id: args.paymentId,
  })
  if (error) {
    return {
      ok: false,
      error: error.message,
      appliedCents: 0,
      balanceAfterCents: current,
    }
  }
  return { ok: true, appliedCents: applied, balanceAfterCents: balanceAfter }
}
