import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

interface PassPurchaseRow {
  id: string
  uses_remaining: number
  expires_at: string
}

// Self-serve member check-in from the visitor's own phone. Uses the
// Supabase session (no kiosk cookie). Mirrors the iPad's /api/checkin/member
// logic minus the device check, since here the trust model is "the
// member is signed in on their own phone."
export async function POST() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, designation')
    .eq('id', user.id)
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
  // Staff, investors, and community contributors check in free.
  const isDesignated = Boolean(member.designation)

  // Recent open visit dedupe.
  const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: openVisit } = await admin
    .from('visits')
    .select('id')
    .eq('user_id', user.id)
    .gte('checked_in_at', recentCutoff)
    .is('checked_out_at', null)
    .limit(1)
    .maybeSingle()
  if (openVisit) {
    return NextResponse.json({
      status: 'already_checked_in',
      member: { fullName: member.full_name, email: member.email },
    })
  }

  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, status, plans(includes_day_access)')
    .eq('user_id', user.id)
    .in('status', ['active', 'past_due'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: passes } = await admin
    .from('pass_purchases')
    .select('id, uses_remaining, expires_at')
    .eq('user_id', user.id)
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

  let passPurchaseId: string | null = null
  if (!hasActiveSubscription) {
    const target = availablePasses[0]
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
      user_id: user.id,
      kind: 'member',
      pass_purchase_id: passPurchaseId,
    })
    .select('id')
    .single()
  if (visitErr || !visit) {
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
  })
}
