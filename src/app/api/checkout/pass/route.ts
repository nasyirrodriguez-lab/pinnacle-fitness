import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getWam } from '@/lib/wam/client'
import { effectivePrice } from '@/lib/pricing/effective'
import { crewDiscountCentsFor } from '@/lib/referrals/crew-discount'
import {
  validateDiscountCode,
  codeFailureMessage,
  applyPercentOff,
} from '@/lib/discounts/codes'
import { payFullyWithCredit } from '@/lib/credits/spend'
import { grantPassFromMetadata } from '@/lib/payments/provision'

const bodySchema = z.object({
  passId: z.string().min(1),
  discountCode: z.string().trim().max(60).optional(),
  // Reserve now, pay cash at the front desk — an admin confirms receipt
  // and the pass activates then.
  payAtDesk: z.boolean().optional(),
})

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'http://localhost:3000'
  )
}

export async function POST(request: NextRequest) {
  // 1. Auth check
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let passId: string
  let discountCode: string | undefined
  let payAtDesk = false
  try {
    const body = bodySchema.parse(await request.json())
    passId = body.passId
    discountCode = body.discountCode || undefined
    payAtDesk = body.payAtDesk === true
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // 3. Look up the pass from the catalog
  const admin = createAdminClient()
  const { data: passRaw, error: passErr } = await admin
    .from('passes')
    .select(
      'id, name, price_cents, discounted_price_cents, discount_expires_at, currency'
    )
    .eq('id', passId)
    .eq('is_active', true)
    .eq('is_private', false)
    .maybeSingle()
  const pass = passRaw as {
    id: string
    name: string
    price_cents: number
    discounted_price_cents: number | null
    discount_expires_at: string | null
    currency: string
  } | null

  if (passErr || !pass) {
    return NextResponse.json({ error: 'Pass not found' }, { status: 404 })
  }

  const { effectiveCents: baseCents } = effectivePrice(pass)
  if (typeof baseCents !== 'number' || baseCents <= 0) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
  }

  // Discount code first, then the crew discount on top.
  let codeCents = baseCents
  let appliedCode: { codeId: string; code: string; percentOff: number } | null =
    null
  if (discountCode) {
    const validation = await validateDiscountCode(admin, {
      code: discountCode,
      userId: user.id,
      kind: 'pass',
      productId: pass.id,
    })
    if (!validation.ok) {
      return NextResponse.json(
        { error: codeFailureMessage(validation.reason) },
        { status: 400 }
      )
    }
    appliedCode = validation
    codeCents = applyPercentOff(baseCents, validation.percentOff)
  }

  // "Bring your crew": referred members get $10 off their first pass.
  const crewOffCents = await crewDiscountCentsFor(admin, user.id)
  const amountCents = Math.max(0, codeCents - crewOffCents)
  if (amountCents <= 0) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
  }

  // Account credit covers the whole price → no card, instant pass.
  const creditSpend = await payFullyWithCredit(admin, {
    userId: user.id,
    amountCents,
    kind: 'pass',
    currency: pass.currency,
    metadata: {
      passId: pass.id,
      ...(crewOffCents > 0 && { crewDiscountCents: crewOffCents }),
      ...(appliedCode && {
        discountCode: appliedCode.code,
        discountCodeId: appliedCode.codeId,
        discountPercent: appliedCode.percentOff,
      }),
    },
    reason: `Applied to ${pass.name}`,
  })
  if (creditSpend.ok) {
    const grant = await grantPassFromMetadata(admin, {
      userId: user.id,
      passId: pass.id,
      paymentId: creditSpend.paymentId,
    })
    if (!grant.ok) {
      console.error('[checkout/pass] credit grant failed:', grant.error)
    }
    return NextResponse.json({
      checkoutUrl: '/dashboard?paid=credit',
      paidWithCredit: true,
    })
  }

  // 4. Create a pending payment row first — we'll match on this in the webhook
  const { data: paymentRaw, error: paymentErr } = await admin
    .from('payments')
    .insert({
      user_id: user.id,
      amount_cents: amountCents,
      currency: pass.currency,
      status: 'pending',
      kind: 'pass',
      ...(payAtDesk && { payment_method: 'cash' }),
      metadata: {
        passId: pass.id,
        ...(payAtDesk && { payAtDesk: true }),
        ...(crewOffCents > 0 && { crewDiscountCents: crewOffCents }),
        ...(appliedCode && {
          discountCode: appliedCode.code,
          discountCodeId: appliedCode.codeId,
          discountPercent: appliedCode.percentOff,
        }),
      },
    })
    .select('id')
    .single()
  const payment = paymentRaw as { id: string } | null

  if (paymentErr || !payment) {
    console.error('[checkout/pass] failed to create payment row:', paymentErr)
    return NextResponse.json(
      { error: 'Could not start payment' },
      { status: 500 }
    )
  }

  if (payment && payAtDesk) {
    const { sendMemberNotification } = await import(
      '@/lib/notifications/notify'
    )
    await sendMemberNotification(admin, {
      userId: user.id,
      title: `Reserved — ${pass.name}`,
      body: `Your ${pass.name} (TTD $${(amountCents / 100).toFixed(0)}) is reserved. Pay cash at the front desk and the team will activate it on the spot.`,
      createdBy: null,
    })
    return NextResponse.json({ payAtDesk: true })
  }

  // 5. Create the Wam intent
  let intent
  try {
    intent = await getWam().createPaymentIntent({
      amountCents,
      currency: pass.currency,
      orderReference: `pass-${payment.id}`,
      description: pass.name,
      returnUrl: `${getSiteUrl()}/checkout/complete?paymentId=${payment.id}`,
      metadata: {
        paymentId: payment.id,
        userId: user.id,
        passId: pass.id,
        kind: 'pass',
      },
    })
  } catch (err) {
    console.error('[checkout/pass] wam intent failed:', err)
    await admin
      .from('payments')
      .update({ status: 'failed', failure_reason: 'wam_intent_failed' })
      .eq('id', payment.id)
    return NextResponse.json(
      { error: 'Payment service unavailable' },
      { status: 502 }
    )
  }

  // 6. Record the Wam payment id back on our payment row
  await admin
    .from('payments')
    .update({ wam_payment_id: intent.paymentId })
    .eq('id', payment.id)

  return NextResponse.json({
    checkoutUrl: intent.checkoutUrl,
    paymentId: payment.id,
  })
}
