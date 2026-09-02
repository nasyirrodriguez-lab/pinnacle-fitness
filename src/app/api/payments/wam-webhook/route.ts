import { NextRequest, NextResponse } from 'next/server'
import { WamPaymentSDK, type WebhookEvent } from '@zed-io/wam-payment-sdk'
import { getWebhookSecret } from '@/lib/wam/client'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  confirmBookingGroupFromMetadata,
  grantPassFromMetadata,
  grantSubscriptionFromMetadata,
} from '@/lib/payments/provision'

// =====================================================================
// The ONLY automatic confirmer of Wam online payments. A signed
// payment_intent.succeeded event is what marks a payment paid and
// provisions the product — polling Wam's status API has produced false
// positives, so neither the checkout return page nor the reconcile cron
// confirm anything anymore.
//
// Provisioning is driven by OUR payment row (kind + metadata written at
// checkout/invoice creation), not by whatever metadata rode along on the
// Wam event — invoices and older checkouts don't mirror everything into
// Wam's metadata.
// =====================================================================

interface WamEventData {
  paymentId: string
  metadata?: Record<string, unknown>
  completedAt?: string
}

const FAILURE_EVENTS = new Set([
  'payment_intent.failed',
  'payment_intent.canceled',
  'payment_intent.expired',
])

interface PaymentRow {
  id: string
  user_id: string | null
  status: string
  kind: string
  metadata: Record<string, unknown> | null
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-wam-signature')
  const timestamp = request.headers.get('x-wam-timestamp')
  if (!signature || !timestamp) {
    return NextResponse.json(
      { error: 'Missing signature headers' },
      { status: 400 }
    )
  }

  // Read the raw body — signature verification needs the exact bytes Wam
  // sent, before any JSON parsing.
  const payload = await request.text()

  let event: WebhookEvent
  try {
    event = WamPaymentSDK.verifyWebhookSignature({
      payload,
      signature,
      timestamp,
      secret: getWebhookSecret(),
    })
  } catch (err) {
    console.error('[wam-webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const isSuccess = event.type === 'payment_intent.succeeded'
  const isFailure = FAILURE_EVENTS.has(event.type)
  if (!isSuccess && !isFailure) {
    return NextResponse.json({ received: true, type: event.type })
  }

  const data = event.data as WamEventData
  const admin = createAdminClient()
  const payment = await findPayment(admin, data)
  if (!payment) {
    console.error('[wam-webhook] no payment row for event', {
      eventId: event.id,
      type: event.type,
      wamPaymentId: data.paymentId,
    })
    // 200 so Wam doesn't retry indefinitely — we'd need a human to fix this.
    return NextResponse.json({ received: true, error: 'payment_not_found' })
  }

  if (isFailure) {
    await admin
      .from('payments')
      .update({
        status: 'failed',
        failure_reason: `wam webhook ${event.type}`,
      })
      .eq('id', payment.id)
      .eq('status', 'pending')
    return NextResponse.json({ received: true, type: event.type })
  }

  // Idempotency: already confirmed (or refunded after confirmation) → no-op.
  if (payment.status === 'succeeded' || payment.status === 'refunded') {
    return NextResponse.json({ received: true, idempotent: true })
  }

  const paidAt = data.completedAt ?? new Date().toISOString()
  const { error: updateErr } = await admin
    .from('payments')
    .update({
      status: 'succeeded',
      paid_at: paidAt,
      failure_reason: null,
      wam_payment_id: data.paymentId,
    })
    .eq('id', payment.id)

  if (updateErr) {
    console.error('[wam-webhook] failed to mark payment succeeded:', updateErr)
    // Return 500 so Wam retries — we want this to succeed.
    return NextResponse.json({ error: 'db_update_failed' }, { status: 500 })
  }

  await provision(admin, payment)

  // Referral qualification fires on the first paid event for the buyer.
  // Subscription + pass both count; meeting-room bookings don't.
  if (
    (payment.kind === 'pass' || payment.kind === 'subscription') &&
    payment.user_id
  ) {
    try {
      const { qualifyReferral } = await import('@/lib/referrals/qualify')
      await qualifyReferral({ admin, referredUserId: payment.user_id })
    } catch (err) {
      console.warn('[wam-webhook] referral qualify failed:', err)
    }
  }

  return NextResponse.json({ received: true })
}

async function findPayment(
  admin: ReturnType<typeof createAdminClient>,
  data: WamEventData
): Promise<PaymentRow | null> {
  const metadata = data.metadata ?? {}
  const ourPaymentId =
    typeof metadata.paymentId === 'string' ? metadata.paymentId : null

  if (ourPaymentId) {
    const { data: row } = await admin
      .from('payments')
      .select('id, user_id, status, kind, metadata')
      .eq('id', ourPaymentId)
      .maybeSingle()
    if (row) return row as PaymentRow
  }

  // Fallback: match on the Wam intent id we stored at creation.
  const { data: row } = await admin
    .from('payments')
    .select('id, user_id, status, kind, metadata')
    .eq('wam_payment_id', data.paymentId)
    .maybeSingle()
  return (row as PaymentRow | null) ?? null
}

async function provision(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRow
): Promise<void> {
  const metadata = payment.metadata ?? {}

  if (payment.kind === 'booking') {
    const groupId =
      typeof metadata.bookingGroupId === 'string'
        ? metadata.bookingGroupId
        : null
    if (!groupId) {
      console.error('[wam-webhook] booking without bookingGroupId', payment.id)
      return
    }
    const r = await confirmBookingGroupFromMetadata(admin, {
      bookingGroupId: groupId,
    })
    if (!r.ok) {
      console.error('[wam-webhook] booking confirm failed', payment.id, r.error)
    }
    return
  }

  if (!payment.user_id) {
    console.warn(
      '[wam-webhook] confirmed without user_id, skipping provision',
      payment.id
    )
    return
  }

  if (payment.kind === 'pass') {
    const passId = typeof metadata.passId === 'string' ? metadata.passId : null
    if (!passId) {
      console.error('[wam-webhook] pass without passId metadata', payment.id)
      return
    }
    const r = await grantPassFromMetadata(admin, {
      userId: payment.user_id,
      passId,
      paymentId: payment.id,
    })
    if (!r.ok) {
      console.error('[wam-webhook] pass grant failed', payment.id, r.error)
    }
    return
  }

  if (payment.kind === 'subscription') {
    const planId = typeof metadata.planId === 'string' ? metadata.planId : null
    if (!planId) {
      console.error(
        '[wam-webhook] subscription without planId metadata',
        payment.id
      )
      return
    }
    const isVirtualOffice =
      metadata.virtualOffice === true ||
      metadata.virtualOffice === 'true' ||
      planId === 'virtual-office-monthly'
    const r = await grantSubscriptionFromMetadata(admin, {
      userId: payment.user_id,
      planId,
      isVirtualOffice,
    })
    if (!r.ok) {
      console.error(
        '[wam-webhook] subscription grant failed',
        payment.id,
        r.error
      )
    }
    return
  }
}
