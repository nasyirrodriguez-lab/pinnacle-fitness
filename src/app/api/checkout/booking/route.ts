import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { computePlanCoverage } from '@/lib/booking/plan-benefits'
import {
  remainingRoomHours,
  consumeRoomHours,
  refundRoomHours,
  type ConsumedCredit,
} from '@/lib/booking/room-credits'
import { payFullyWithCredit, refundCreditPayment } from '@/lib/credits/spend'
import { createAdminClient } from '@/utils/supabase/admin'
import { getWam } from '@/lib/wam/client'
import { priceSlotsCents, rateForSlotCents } from '@/lib/booking/slots'

const slotSchema = z.object({
  startIso: z.string().min(1),
  endIso: z.string().min(1),
})

const bodySchema = z.object({
  resourceId: z.string().min(1),
  // 16 half-hour slots = a full 9-to-5 day on one booking.
  slots: z.array(slotSchema).min(1).max(16),
})

const HOLD_TTL_MINUTES = 15

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'http://localhost:3000'
  )
}

function tstzRange(startIso: string, endIso: string): string {
  // Postgres tstzrange literal, half-open: [start, end)
  return `[${startIso},${endIso})`
}

export async function POST(request: NextRequest) {
  // 1. Auth
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Backstop for the /welcome gate on the booking page: no booking
  // lands without a name and accepted terms on the profile, even from
  // a stale tab opened before the gate existed.
  const { data: bookerProfile } = await supabase
    .from('profiles')
    .select('full_name, terms_accepted_at')
    .eq('id', user.id)
    .maybeSingle()
  const booker = bookerProfile as {
    full_name: string | null
    terms_accepted_at: string | null
  } | null
  if (!booker?.full_name?.trim() || !booker.terms_accepted_at) {
    return NextResponse.json(
      {
        error:
          'Almost there — finish setting up your account first. Refresh this page and we’ll walk you through it.',
      },
      { status: 403 }
    )
  }

  // 2. Parse body
  let body
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // 3. Validate slots
  const now = Date.now()
  for (const slot of body.slots) {
    const start = new Date(slot.startIso).getTime()
    const end = new Date(slot.endIso).getTime()
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return NextResponse.json({ error: 'Invalid slot time' }, { status: 400 })
    }
    if (end <= start) {
      return NextResponse.json(
        { error: 'Slot end must be after start' },
        { status: 400 }
      )
    }
    if (end < now) {
      return NextResponse.json(
        { error: 'Slot is in the past' },
        { status: 400 }
      )
    }
  }

  // 4. Look up resource + price
  const admin = createAdminClient()
  const { data: resourceRow, error: resourceErr } = await admin
    .from('resources')
    .select(
      'id, name, price_per_hour_cents, after_hours_price_per_hour_cents, after_hours_starts_at_hour, currency, is_bookable, admin_only'
    )
    .eq('id', body.resourceId)
    .eq('is_bookable', true)
    .maybeSingle()
  if (resourceErr || !resourceRow) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
  }
  const resource = resourceRow as {
    id: string
    name: string
    price_per_hour_cents: number | null
    after_hours_price_per_hour_cents: number | null
    after_hours_starts_at_hour: number | null
    currency: string
    admin_only: boolean
  }
  if (resource.admin_only) {
    return NextResponse.json(
      { error: 'This space is admin-bookable only' },
      { status: 403 }
    )
  }
  if ((resource.price_per_hour_cents ?? 0) <= 0) {
    return NextResponse.json(
      { error: 'Resource is not priced for self-service booking' },
      { status: 400 }
    )
  }

  // 5. Plan coverage first: slots the member's plan includes are free.
  //    Then price the remainder via the shared helper (tiered pricing).
  const coverage = await computePlanCoverage(admin, {
    userId: user.id,
    resourceId: resource.id,
    slots: body.slots,
  })
  let billableSlots = body.slots.filter((_, i) => !coverage.covered[i])

  // Room-hour credits pick up where the plan stops — when they can
  // cover the entire remainder, the whole booking goes through free.
  let consumedCredits: ConsumedCredit[] = []
  if (billableSlots.length > 0) {
    const uncoveredHours = billableSlots.reduce(
      (sum, slot) =>
        sum +
        (new Date(slot.endIso).getTime() - new Date(slot.startIso).getTime()) /
          (60 * 60 * 1000),
      0
    )
    const creditHours = await remainingRoomHours(admin, user.id, resource.id)
    if (creditHours >= uncoveredHours) {
      const take = await consumeRoomHours(
        admin,
        user.id,
        resource.id,
        uncoveredHours
      )
      if (take.ok) {
        consumedCredits = take.consumed
        coverage.covered = body.slots.map(() => true)
        billableSlots = []
      }
    }
  }

  const totalCents =
    billableSlots.length > 0 ? priceSlotsCents(resource, billableSlots) : 0
  if (totalCents <= 0 && billableSlots.length > 0) {
    return NextResponse.json(
      { error: 'Total is zero — pick at least one slot' },
      { status: 400 }
    )
  }

  // Fully covered by the plan and/or room-hour credits: confirm
  // immediately, no payment involved.
  if (totalCents === 0) {
    const { data: freeGroupRow, error: freeGroupErr } = await admin
      .from('booking_groups')
      .insert({
        user_id: user.id,
        total_cents: 0,
        currency: resource.currency,
        status: 'confirmed',
        expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
      })
      .select('id')
      .single()
    if (freeGroupErr || !freeGroupRow) {
      console.error('[checkout/booking] free group failed:', freeGroupErr)
      await refundRoomHours(admin, consumedCredits)
      return NextResponse.json(
        { error: 'Could not start booking' },
        { status: 500 }
      )
    }
    const freeGroupId = (freeGroupRow as { id: string }).id
    for (const slot of body.slots) {
      const { error: bookingErr } = await admin.from('bookings').insert({
        user_id: user.id,
        resource_id: resource.id,
        during: tstzRange(slot.startIso, slot.endIso),
        status: 'confirmed',
        price_cents: 0,
        covered_by_plan: true,
        booking_group_id: freeGroupId,
      })
      if (bookingErr) {
        await admin
          .from('bookings')
          .delete()
          .eq('booking_group_id', freeGroupId)
        await admin.from('booking_groups').delete().eq('id', freeGroupId)
        await refundRoomHours(admin, consumedCredits)
        const isConflict = (bookingErr as { code?: string }).code === '23P01'
        return NextResponse.json(
          {
            error: isConflict
              ? 'One of those slots was just booked. Refresh and pick another time.'
              : 'Could not reserve your slot',
          },
          { status: isConflict ? 409 : 500 }
        )
      }
    }
    return NextResponse.json({
      checkoutUrl: '/dashboard/bookings?covered=1',
      coveredByPlan: true,
    })
  }

  // Account credit covers the whole booking → no card, instant confirm.
  const creditSpend = await payFullyWithCredit(admin, {
    userId: user.id,
    amountCents: totalCents,
    kind: 'booking',
    currency: resource.currency,
    metadata: { resourceId: resource.id, slotCount: body.slots.length },
    reason: `Applied to ${resource.name} booking`,
  })
  if (creditSpend.ok) {
    const { data: creditGroupRow, error: creditGroupErr } = await admin
      .from('booking_groups')
      .insert({
        user_id: user.id,
        total_cents: totalCents,
        currency: resource.currency,
        status: 'confirmed',
        payment_id: creditSpend.paymentId,
        expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
      })
      .select('id')
      .single()
    if (creditGroupErr || !creditGroupRow) {
      console.error('[checkout/booking] credit group failed:', creditGroupErr)
      await refundCreditPayment(admin, {
        userId: user.id,
        paymentId: creditSpend.paymentId,
        amountCents: totalCents,
        reason: 'Refund: booking could not be created',
      })
      return NextResponse.json(
        { error: 'Could not start booking' },
        { status: 500 }
      )
    }
    const creditGroupId = (creditGroupRow as { id: string }).id
    for (const [slotIndex, slot] of body.slots.entries()) {
      const isCovered = coverage.covered[slotIndex]
      const slotHours =
        (new Date(slot.endIso).getTime() - new Date(slot.startIso).getTime()) /
        (60 * 60 * 1000)
      const { error: bookingErr } = await admin.from('bookings').insert({
        user_id: user.id,
        resource_id: resource.id,
        during: tstzRange(slot.startIso, slot.endIso),
        status: 'confirmed',
        price_cents: isCovered
          ? 0
          : Math.round(slotHours * rateForSlotCents(resource, slot.startIso)),
        covered_by_plan: isCovered,
        payment_id: creditSpend.paymentId,
        booking_group_id: creditGroupId,
      })
      if (bookingErr) {
        await admin
          .from('bookings')
          .delete()
          .eq('booking_group_id', creditGroupId)
        await admin.from('booking_groups').delete().eq('id', creditGroupId)
        await refundCreditPayment(admin, {
          userId: user.id,
          paymentId: creditSpend.paymentId,
          amountCents: totalCents,
          reason: 'Refund: booking slot was taken',
        })
        const isConflict = (bookingErr as { code?: string }).code === '23P01'
        return NextResponse.json(
          {
            error: isConflict
              ? 'One of those slots was just booked. Refresh and pick another time.'
              : 'Could not reserve your slot',
          },
          { status: isConflict ? 409 : 500 }
        )
      }
    }
    return NextResponse.json({
      checkoutUrl: '/dashboard/bookings?paid=credit',
      paidWithCredit: true,
    })
  }

  // 6. Create the booking group + pending payment + held bookings, all
  //    server-side. Exclusion constraint on bookings catches conflicts.
  const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000)

  const { data: groupRow, error: groupErr } = await admin
    .from('booking_groups')
    .insert({
      user_id: user.id,
      total_cents: totalCents,
      currency: resource.currency,
      status: 'held',
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()
  if (groupErr || !groupRow) {
    console.error('[checkout/booking] failed to create group:', groupErr)
    return NextResponse.json(
      { error: 'Could not start booking' },
      { status: 500 }
    )
  }
  const groupId = (groupRow as { id: string }).id

  // 7. Create the pending payment row
  const { data: paymentRow, error: paymentErr } = await admin
    .from('payments')
    .insert({
      user_id: user.id,
      amount_cents: totalCents,
      currency: resource.currency,
      status: 'pending',
      kind: 'booking',
      metadata: {
        resourceId: resource.id,
        bookingGroupId: groupId,
        slotCount: body.slots.length,
      },
    })
    .select('id')
    .single()
  if (paymentErr || !paymentRow) {
    console.error('[checkout/booking] failed to create payment:', paymentErr)
    // Clean up group
    await admin.from('booking_groups').delete().eq('id', groupId)
    return NextResponse.json(
      { error: 'Could not start payment' },
      { status: 500 }
    )
  }
  const paymentId = (paymentRow as { id: string }).id

  // Link payment to group
  await admin
    .from('booking_groups')
    .update({ payment_id: paymentId })
    .eq('id', groupId)

  // 8. Insert each booking row with status='held'. Exclusion constraint
  //    on (resource_id, during) prevents conflicts atomically per-row.
  for (const [slotIndex, slot] of body.slots.entries()) {
    const isCovered = coverage.covered[slotIndex]
    const slotHours =
      (new Date(slot.endIso).getTime() - new Date(slot.startIso).getTime()) /
      (60 * 60 * 1000)
    const slotPriceCents = isCovered
      ? 0
      : Math.round(slotHours * rateForSlotCents(resource, slot.startIso))

    const { error: bookingErr } = await admin.from('bookings').insert({
      user_id: user.id,
      resource_id: resource.id,
      during: tstzRange(slot.startIso, slot.endIso),
      status: 'held',
      price_cents: slotPriceCents,
      covered_by_plan: isCovered,
      payment_id: paymentId,
      booking_group_id: groupId,
    })

    if (bookingErr) {
      console.error('[checkout/booking] booking insert failed:', bookingErr)
      // Roll back: delete the bookings we already inserted in this group,
      // the payment, and the group.
      await admin.from('bookings').delete().eq('booking_group_id', groupId)
      await admin.from('payments').delete().eq('id', paymentId)
      await admin.from('booking_groups').delete().eq('id', groupId)

      // Exclusion-constraint violations come back as code 23P01
      const isConflict = (bookingErr as { code?: string }).code === '23P01'
      return NextResponse.json(
        {
          error: isConflict
            ? 'One of those slots was just booked. Refresh and pick another time.'
            : 'Could not reserve your slot',
        },
        { status: isConflict ? 409 : 500 }
      )
    }
  }

  // 9. Create Wam intent
  let intent
  try {
    intent = await getWam().createPaymentIntent({
      amountCents: totalCents,
      currency: resource.currency,
      orderReference: `booking-${paymentId}`,
      description: `${resource.name} — ${body.slots.length} slot${body.slots.length === 1 ? '' : 's'}`,
      returnUrl: `${getSiteUrl()}/checkout/complete?paymentId=${paymentId}`,
      metadata: {
        paymentId,
        userId: user.id,
        kind: 'booking',
        resourceId: resource.id,
        bookingGroupId: groupId,
      },
    })
  } catch (err) {
    console.error('[checkout/booking] wam intent failed:', err)
    // Mark everything failed but DON'T delete bookings — leave them held
    // so the hold-expiry cron releases them naturally.
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
    bookingGroupId: groupId,
  })
}
