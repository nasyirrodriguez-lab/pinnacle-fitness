import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getWam } from '@/lib/wam/client'
import { effectivePrice } from '@/lib/pricing/effective'
import {
  validateDiscountCode,
  codeFailureMessage,
  applyPercentOff,
} from '@/lib/discounts/codes'
import { payFullyWithCredit } from '@/lib/credits/spend'
import { grantSubscriptionFromMetadata } from '@/lib/payments/provision'

const bodySchema = z.object({
  discountCode: z.string().trim().max(60).optional(),
  planId: z.string().min(1),
  payAtDesk: z.boolean().optional(),
})

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'http://localhost:3000'
  )
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let planId: string
  let discountCode: string | undefined
  let payAtDesk = false
  try {
    const parsed = bodySchema.parse(await request.json())
    planId = parsed.planId
    discountCode = parsed.discountCode || undefined
    payAtDesk = parsed.payAtDesk === true
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Refuse if the user already has an active subscription. We'll add an
  // "upgrade/downgrade" path later — for now keep it simple.
  const { data: existingSub } = await admin
    .from('subscriptions')
    .select('id, plan_id, status')
    .eq('user_id', user.id)
    .in('status', ['active', 'past_due', 'paused'])
    .maybeSingle()
  if (existingSub) {
    return NextResponse.json(
      {
        error:
          'You already have an active membership. Ask a coach or email hello@pinnaclefitness.app to change plans.',
      },
      { status: 409 }
    )
  }

  const { data: planRow, error: planErr } = await admin
    .from('plans')
    .select(
      'id, name, price_cents, discounted_price_cents, discount_expires_at, currency, billing_period'
    )
    .eq('id', planId)
    .eq('is_active', true)
    .eq('is_private', false)
    .maybeSingle()
  if (planErr || !planRow) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }
  const plan = planRow as {
    id: string
    name: string
    price_cents: number
    discounted_price_cents: number | null
    discount_expires_at: string | null
    currency: string
    billing_period: string
  }

  const { effectiveCents: baseCents } = effectivePrice(plan)
  let chargeCents = baseCents
  let appliedCode: { codeId: string; code: string; percentOff: number } | null =
    null
  if (discountCode) {
    const validation = await validateDiscountCode(admin, {
      code: discountCode,
      userId: user.id,
      kind: 'plan',
      productId: plan.id,
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
  if (chargeCents <= 0) {
    return NextResponse.json({ error: 'Invalid plan price' }, { status: 400 })
  }

  // Account credit covers the whole price → no card, instant membership.
  const creditSpend = await payFullyWithCredit(admin, {
    userId: user.id,
    amountCents: chargeCents,
    kind: 'subscription',
    currency: plan.currency,
    metadata: {
      planId: plan.id,
      billingPeriod: plan.billing_period,
      ...(appliedCode && {
        discountCode: appliedCode.code,
        discountCodeId: appliedCode.codeId,
        discountPercent: appliedCode.percentOff,
      }),
    },
    reason: `Applied to ${plan.id} membership`,
  })
  if (creditSpend.ok) {
    const grant = await grantSubscriptionFromMetadata(admin, {
      userId: user.id,
      planId: plan.id,
    })
    if (!grant.ok) {
      console.error('[checkout/plan] credit grant failed:', grant.error)
    }
    return NextResponse.json({
      checkoutUrl: '/dashboard?paid=credit',
      paidWithCredit: true,
    })
  }

  // Create pending payment so we can match on it in the webhook
  const { data: paymentRow, error: paymentErr } = await admin
    .from('payments')
    .insert({
      user_id: user.id,
      amount_cents: chargeCents,
      currency: plan.currency,
      status: 'pending',
      kind: 'subscription',
      ...(payAtDesk && { payment_method: 'cash' }),
      metadata: {
        planId: plan.id,
        billingPeriod: plan.billing_period,
        ...(payAtDesk && { payAtDesk: true }),
        ...(appliedCode && {
          discountCode: appliedCode.code,
          discountCodeId: appliedCode.codeId,
          discountPercent: appliedCode.percentOff,
        }),
      },
    })
    .select('id')
    .single()
  if (paymentErr || !paymentRow) {
    console.error('[checkout/plan] payment insert failed:', paymentErr)
    return NextResponse.json(
      { error: 'Could not start payment' },
      { status: 500 }
    )
  }
  const paymentId = (paymentRow as { id: string }).id

  if (payAtDesk) {
    const { sendMemberNotification } = await import(
      '@/lib/notifications/notify'
    )
    await sendMemberNotification(admin, {
      userId: user.id,
      title: `Reserved — ${plan.name}`,
      body: `Your ${plan.name} membership (TTD $${(chargeCents / 100).toFixed(0)}) is reserved. Pay cash at the front desk and the team will activate it on the spot.`,
      createdBy: null,
    })
    return NextResponse.json({ payAtDesk: true })
  }

  let intent
  try {
    intent = await getWam().createPaymentIntent({
      amountCents: chargeCents,
      currency: plan.currency,
      orderReference: `subscription-${paymentId}`,
      description: `${plan.name} — first ${plan.billing_period}`,
      returnUrl: `${getSiteUrl()}/checkout/complete?paymentId=${paymentId}`,
      metadata: {
        paymentId,
        userId: user.id,
        kind: 'subscription',
        planId: plan.id,
        billingPeriod: plan.billing_period,
      },
    })
  } catch (err) {
    console.error('[checkout/plan] wam intent failed:', err)
    await admin
      .from('payments')
      .update({ status: 'failed', failure_reason: 'wam_intent_failed' })
      .eq('id', paymentId)
    return NextResponse.json(
      { error: 'Payment service unavailable' },
      { status: 502 }
    )
  }

  await admin
    .from('payments')
    .update({ wam_payment_id: intent.paymentId })
    .eq('id', paymentId)

  return NextResponse.json({
    checkoutUrl: intent.checkoutUrl,
    paymentId,
  })
}
