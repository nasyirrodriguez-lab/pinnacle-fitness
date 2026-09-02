import type { SupabaseClient } from '@supabase/supabase-js'
import { getWam } from '@/lib/wam/client'
import { sendInvoiceEmail } from '@/lib/email/invoice'
import { sendMemberNotification } from '@/lib/notifications/notify'

// Official Worx invoices. Every invoice is backed by a pending payment
// with a Wam intent, so "did they pay?" is answered by the same
// webhook/reconcile pipeline as every other payment — the invoice shows
// paid the moment the money confirms. Subscription-backed invoices
// carry planId metadata so paying one renews the membership.

export interface InvoiceLineItem {
  label: string
  amountCents: number
}

export type InvoiceKind =
  | 'virtual_office'
  | 'office_rental'
  | 'membership'
  | 'booking'
  | 'other'

export interface CreateInvoiceArgs {
  userId: string
  kind: InvoiceKind
  lineItems: InvoiceLineItem[]
  periodLabel?: string | null
  dueAt?: string | null
  // Paying this invoice renews this plan (VO / office rental / membership).
  planId?: string | null
  createdBy?: string | null
}

export type CreateInvoiceResult =
  | { ok: true; invoiceId: string; number: string; amountCents: number }
  | { ok: false; error: string }

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://theworx.io'
  )
}

export async function createInvoice(
  admin: SupabaseClient,
  args: CreateInvoiceArgs
): Promise<CreateInvoiceResult> {
  const lineItems = args.lineItems.filter(
    (l) => l.label.trim().length > 0 && l.amountCents >= 0
  )
  const amountCents = lineItems.reduce((sum, l) => sum + l.amountCents, 0)
  if (lineItems.length === 0 || amountCents <= 0) {
    return { ok: false, error: 'An invoice needs at least one priced item' }
  }

  const { data: profileRow } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', args.userId)
    .maybeSingle()
  if (!profileRow) return { ok: false, error: 'Member not found' }
  const profile = profileRow as { email: string; full_name: string | null }

  const { data: numberData, error: numberErr } = await admin.rpc(
    'next_invoice_number'
  )
  if (numberErr || typeof numberData !== 'string') {
    console.error('[invoices] number allocation failed:', numberErr)
    return { ok: false, error: 'Could not allocate an invoice number' }
  }
  const number = numberData

  // Backing payment — pending until Wam confirms, exactly like checkout.
  const metadata: Record<string, unknown> = {
    invoiceNumber: number,
    invoiceKind: args.kind,
  }
  if (args.planId) {
    metadata.planId = args.planId
    metadata.billingPeriod = 'month'
    if (args.planId === 'virtual-office-monthly') metadata.virtualOffice = true
  }
  const { data: paymentRow, error: payErr } = await admin
    .from('payments')
    .insert({
      user_id: args.userId,
      amount_cents: amountCents,
      currency: 'TTD',
      status: 'pending',
      kind: args.planId ? 'subscription' : 'one_time',
      payment_method: 'wam_online',
      metadata,
    })
    .select('id')
    .single()
  if (payErr || !paymentRow) {
    console.error('[invoices] payment insert failed:', payErr)
    return { ok: false, error: 'Could not create the invoice payment' }
  }
  const paymentId = (paymentRow as { id: string }).id

  let payUrl: string
  try {
    const intent = await getWam().createPaymentIntent({
      amountCents,
      currency: 'TTD',
      orderReference: `invoice-${paymentId}`,
      description: `The Worx invoice ${number}`,
      returnUrl: `${getSiteUrl()}/checkout/complete?paymentId=${paymentId}`,
      metadata: { paymentId, userId: args.userId, invoiceNumber: number },
    })
    payUrl = intent.checkoutUrl
    await admin
      .from('payments')
      .update({ wam_payment_id: intent.paymentId })
      .eq('id', paymentId)
  } catch (err) {
    console.error('[invoices] wam intent failed:', err)
    await admin.from('payments').delete().eq('id', paymentId)
    return { ok: false, error: 'Payment service unavailable — try again' }
  }

  const { data: invoiceRow, error: invErr } = await admin
    .from('invoices')
    .insert({
      number,
      user_id: args.userId,
      payment_id: paymentId,
      kind: args.kind,
      line_items: lineItems,
      amount_cents: amountCents,
      period_label: args.periodLabel ?? null,
      due_at: args.dueAt ?? null,
      sent_at: new Date().toISOString(),
      created_by: args.createdBy ?? null,
    })
    .select('id')
    .single()
  if (invErr || !invoiceRow) {
    console.error('[invoices] insert failed:', invErr)
    await admin.from('payments').delete().eq('id', paymentId)
    return { ok: false, error: 'Could not save the invoice' }
  }
  const invoiceId = (invoiceRow as { id: string }).id

  const firstName = (profile.full_name ?? '').trim().split(/\s+/)[0] || null
  await sendInvoiceEmail({
    to: profile.email,
    firstName,
    number,
    lineItems,
    amountCents,
    periodLabel: args.periodLabel ?? null,
    dueAt: args.dueAt ?? null,
    payUrl,
    viewUrl: `${getSiteUrl()}/dashboard/invoices/${invoiceId}`,
  })
  await sendMemberNotification(admin, {
    userId: args.userId,
    title: `Invoice ${number} — TTD $${(amountCents / 100).toFixed(0)}`,
    body: `Your Worx invoice${args.periodLabel ? ` for ${args.periodLabel}` : ''} is ready. Pay online from the email we just sent, or view it in your dashboard under Invoices.`,
    createdBy: args.createdBy ?? null,
  })

  return { ok: true, invoiceId, number, amountCents }
}
