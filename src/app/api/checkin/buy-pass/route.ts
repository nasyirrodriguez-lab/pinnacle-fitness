import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { createAdminClient } from '@/utils/supabase/admin'
import { getWam } from '@/lib/wam/client'
import { effectivePrice } from '@/lib/pricing/effective'
import {
  validateDiscountCode,
  codeFailureMessage,
  applyPercentOff,
} from '@/lib/discounts/codes'

const bodySchema = z.object({
  userId: z.string().uuid(),
  passId: z.string().min(1),
  discountCode: z.string().trim().max(60).optional(),
})

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'http://localhost:3000'
  )
}

// Kiosk polls this while the member pays on their own phone (the kiosk
// shows the checkout link as a QR — iOS standalone-PWA webviews can't
// reliably host the card form, so payment happens in the member's own
// browser and the kiosk just watches for the webhook to confirm).
export async function GET(request: NextRequest) {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }
  const paymentId = request.nextUrl.searchParams.get('paymentId')
  if (!paymentId || !z.string().uuid().safeParse(paymentId).success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from('payments')
    .select('status, metadata')
    .eq('id', paymentId)
    .maybeSingle()
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const row = data as {
    status: string
    metadata: Record<string, unknown> | null
  }
  // Only expose kiosk-originated payments to the kiosk.
  if (row.metadata?.viaKiosk !== true && row.metadata?.viaKiosk !== 'true') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ status: row.status })
}

export async function POST(request: NextRequest) {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  let body
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: pass } = await admin
    .from('passes')
    .select(
      'id, name, price_cents, discounted_price_cents, discount_expires_at, currency'
    )
    .eq('id', body.passId)
    .eq('is_active', true)
    .eq('is_private', false)
    .maybeSingle()
  if (!pass) {
    return NextResponse.json({ error: 'pass_not_found' }, { status: 404 })
  }
  const p = pass as {
    id: string
    name: string
    price_cents: number
    discounted_price_cents: number | null
    discount_expires_at: string | null
    currency: string
  }

  const { effectiveCents: baseCents } = effectivePrice(p)
  let chargeCents = baseCents
  let appliedCode: { codeId: string; code: string; percentOff: number } | null =
    null
  if (body.discountCode) {
    const validation = await validateDiscountCode(admin, {
      code: body.discountCode,
      userId: body.userId,
      kind: 'pass',
      productId: p.id,
    })
    if (!validation.ok) {
      return NextResponse.json(
        { error: codeFailureMessage(validation.reason) },
        { status: 400 }
      )
    }
    appliedCode = validation
    chargeCents = applyPercentOff(baseCents, validation.percentOff)
  }

  const { data: payment, error: payErr } = await admin
    .from('payments')
    .insert({
      user_id: body.userId,
      amount_cents: chargeCents,
      currency: p.currency,
      status: 'pending',
      kind: 'pass',
      metadata: {
        passId: p.id,
        viaKiosk: true,
        deviceId: device.id,
        ...(appliedCode && {
          discountCode: appliedCode.code,
          discountCodeId: appliedCode.codeId,
          discountPercent: appliedCode.percentOff,
        }),
      },
    })
    .select('id')
    .single()
  if (payErr || !payment) {
    return NextResponse.json({ error: 'payment_init_failed' }, { status: 500 })
  }
  const paymentId = (payment as { id: string }).id

  try {
    const intent = await getWam().createPaymentIntent({
      amountCents: chargeCents,
      currency: p.currency,
      orderReference: `pass-${paymentId}`,
      description: `${p.name} (kiosk)`,
      returnUrl: `${getSiteUrl()}/checkin/buy-pass/complete?paymentId=${paymentId}`,
      metadata: {
        paymentId,
        userId: body.userId,
        kind: 'pass',
        passId: p.id,
        viaKiosk: 'true',
      },
    })
    await admin
      .from('payments')
      .update({ wam_payment_id: intent.paymentId })
      .eq('id', paymentId)
    return NextResponse.json({ checkoutUrl: intent.checkoutUrl, paymentId })
  } catch (err) {
    console.error('[checkin/buy-pass] wam intent failed:', err)
    await admin
      .from('payments')
      .update({ status: 'failed', failure_reason: 'wam_intent_failed' })
      .eq('id', paymentId)
    return NextResponse.json({ error: 'wam_unavailable' }, { status: 502 })
  }
}
