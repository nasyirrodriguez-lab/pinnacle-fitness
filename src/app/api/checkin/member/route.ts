import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { verifyCheckinToken } from '@/lib/checkin/qr'
import { createAdminClient } from '@/utils/supabase/admin'

const bodySchema = z
  .object({
    token: z.string().min(1).optional(),
    userId: z.string().uuid().optional(),
    passPurchaseId: z.string().uuid().optional(),
  })
  .refine((v) => Boolean(v.token || v.userId), {
    message: 'token or userId required',
  })

interface PassPurchaseRow {
  id: string
  uses_remaining: number
  expires_at: string
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

  let userId: string | null = null
  if (body.token) {
    const payload = verifyCheckinToken(body.token)
    if (!payload) {
      return NextResponse.json({ error: 'invalid_qr' }, { status: 400 })
    }
    userId = payload.uid
  } else if (body.userId) {
    userId = body.userId
  }
  if (!userId) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, designation')
    .eq('id', userId)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json({ error: 'unknown_member' }, { status: 404 })
  }
  const member = profile as {
    id: string
    full_name: string | null
    email: string
    designation: string | null
  }
  // Staff, investors, and community contributors check in free — no
  // pass required, nothing deducted.
  const isDesignated = Boolean(member.designation)

  // Recent open visit (last 30 minutes) — if there is one, just acknowledge
  // it instead of double-recording.
  const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: openVisit } = await admin
    .from('visits')
    .select('id, checked_in_at')
    .eq('user_id', userId)
    .gte('checked_in_at', recentCutoff)
    .is('checked_out_at', null)
    .limit(1)
    .maybeSingle()
  if (openVisit) {
    return NextResponse.json({
      status: 'already_checked_in',
      member: { fullName: member.full_name, email: member.email },
      visitId: (openVisit as { id: string }).id,
    })
  }

  // Check membership: active subscription OR available pass.
  const { data: sub } = await admin
    .from('subscriptions')
    .select(
      'id, plan_id, status, current_period_end, plans(includes_day_access)'
    )
    .eq('user_id', userId)
    .in('status', ['active', 'past_due'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: passes } = await admin
    .from('pass_purchases')
    .select('id, uses_remaining, expires_at')
    .eq('user_id', userId)
    .gt('uses_remaining', 0)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
  const availablePasses = (passes ?? []) as unknown as PassPurchaseRow[]

  // Plans can exclude daily workspace access (e.g. room-hours-only
  // packages) — those don't grant free check-in.
  const subPlanRaw = (
    sub as {
      plans?:
        | { includes_day_access?: boolean }
        | { includes_day_access?: boolean }[]
        | null
    } | null
  )?.plans
  const subPlan = Array.isArray(subPlanRaw)
    ? (subPlanRaw[0] ?? null)
    : subPlanRaw
  const subGrantsAccess = Boolean(sub) && subPlan?.includes_day_access !== false
  const hasActiveSubscription = subGrantsAccess || isDesignated
  const hasPasses = availablePasses.length > 0

  if (!hasActiveSubscription && !hasPasses) {
    return NextResponse.json({
      status: 'needs_payment',
      member: {
        id: member.id,
        fullName: member.full_name,
        email: member.email,
      },
    })
  }

  // If member has a subscription, no pass deduction. If they have only
  // passes, deduct one (or the chosen passPurchaseId).
  let passPurchaseId: string | null = null
  if (!hasActiveSubscription) {
    const target = body.passPurchaseId
      ? availablePasses.find((p) => p.id === body.passPurchaseId)
      : availablePasses[0]
    if (!target) {
      return NextResponse.json({ error: 'pass_not_available' }, { status: 400 })
    }
    const { error: decErr } = await admin
      .from('pass_purchases')
      .update({ uses_remaining: target.uses_remaining - 1 })
      .eq('id', target.id)
      .gt('uses_remaining', 0)
    if (decErr) {
      return NextResponse.json({ error: 'pass_deduct_failed' }, { status: 500 })
    }
    passPurchaseId = target.id
  }

  const { data: visit, error: visitErr } = await admin
    .from('visits')
    .insert({
      user_id: userId,
      kind: 'member',
      pass_purchase_id: passPurchaseId,
      device_id: device.id,
    })
    .select('id, checked_in_at')
    .single()
  if (visitErr || !visit) {
    // If we deducted a pass we should restore it. Best-effort.
    if (passPurchaseId) {
      const target = availablePasses.find((p) => p.id === passPurchaseId)
      if (target) {
        await admin
          .from('pass_purchases')
          .update({ uses_remaining: target.uses_remaining })
          .eq('id', target.id)
      }
    }
    return NextResponse.json({ error: 'visit_insert_failed' }, { status: 500 })
  }

  return NextResponse.json({
    status: 'checked_in',
    member: {
      id: member.id,
      fullName: member.full_name,
      email: member.email,
    },
    via: isDesignated
      ? 'designation'
      : hasActiveSubscription
        ? 'subscription'
        : 'pass',
    passDeducted: passPurchaseId
      ? availablePasses.find((p) => p.id === passPurchaseId)?.uses_remaining
      : undefined,
    visitId: (visit as { id: string }).id,
  })
}
