import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getCreditBalanceCents,
  applyCreditToPayment,
} from '@/lib/credits/balance'

// Pay for something entirely with account credit: creates a succeeded
// payment (method 'credit'), debits the ledger against it, and hands
// back the payment id for provisioning. Only used when the balance
// covers the FULL amount — partial credit stays a front-desk flow so
// online card charges never need mid-flight refunds.

export type CreditSpendResult =
  | { ok: true; paymentId: string }
  | { ok: false; reason: 'insufficient' | 'failed' }

export async function payFullyWithCredit(
  admin: SupabaseClient,
  args: {
    userId: string
    amountCents: number
    kind: 'pass' | 'subscription' | 'booking'
    currency: string
    metadata: Record<string, unknown>
    reason: string
  }
): Promise<CreditSpendResult> {
  if (args.amountCents <= 0) return { ok: false, reason: 'insufficient' }
  const balance = await getCreditBalanceCents(admin, args.userId)
  if (balance < args.amountCents) return { ok: false, reason: 'insufficient' }

  const { data: paymentRow, error: payErr } = await admin
    .from('payments')
    .insert({
      user_id: args.userId,
      amount_cents: args.amountCents,
      currency: args.currency,
      status: 'succeeded',
      kind: args.kind,
      payment_method: 'credit',
      paid_at: new Date().toISOString(),
      metadata: { ...args.metadata, paidWithCredit: true },
    })
    .select('id')
    .single()
  if (payErr || !paymentRow) {
    console.error('[credits/spend] payment insert failed:', payErr)
    return { ok: false, reason: 'failed' }
  }
  const paymentId = (paymentRow as { id: string }).id

  const applied = await applyCreditToPayment(admin, {
    userId: args.userId,
    paymentId,
    requestedCents: args.amountCents,
    reason: args.reason,
  })
  if (!applied.ok || applied.appliedCents < args.amountCents) {
    // Balance changed underneath us — roll the payment back.
    console.error('[credits/spend] ledger debit fell short:', applied)
    await admin.from('payments').delete().eq('id', paymentId)
    return { ok: false, reason: 'failed' }
  }

  return { ok: true, paymentId }
}

// Undo a credit payment (e.g. the booking slot got taken mid-checkout):
// hands the money back on the ledger and marks the payment refunded.
export async function refundCreditPayment(
  admin: SupabaseClient,
  args: {
    userId: string
    paymentId: string
    amountCents: number
    reason: string
  }
): Promise<void> {
  const balance = await getCreditBalanceCents(admin, args.userId)
  const { error: ledgerErr } = await admin.from('credit_ledger').insert({
    user_id: args.userId,
    amount_cents: args.amountCents,
    balance_after_cents: balance + args.amountCents,
    reason: args.reason,
    payment_id: args.paymentId,
  })
  if (ledgerErr) {
    console.error('[credits/spend] refund ledger insert failed:', ledgerErr)
  }
  await admin
    .from('payments')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', args.paymentId)
}
