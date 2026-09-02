import type { SupabaseClient } from '@supabase/supabase-js'
import { grantSessions, resetMonthlyGrant } from '@/lib/sessions/ledger'

// Shared product-provision helpers used by the Wam webhook, the manual
// admin payment recorder, payment requests, the kiosk cash confirm and
// the reconcile action. Every activation path funnels through these two
// functions so the session ledger is always written the same way:
//   - a plan month → hard-reset grant of that plan's PT / open-gym sessions
//   - a pack → a grant with a 30-day (validity_days) expiry

export interface ProvisionResult {
  ok: boolean
  error?: string
  passPurchaseId?: string
  subscriptionId?: string
}

export async function grantPassFromMetadata(
  admin: SupabaseClient,
  args: {
    userId: string
    passId: string
    paymentId: string
  }
): Promise<ProvisionResult> {
  const { data: pass } = await admin
    .from('passes')
    .select('uses_total, validity_days, session_kind')
    .eq('id', args.passId)
    .maybeSingle()
  if (!pass) return { ok: false, error: `Pass "${args.passId}" not found` }
  const p = pass as {
    uses_total: number
    validity_days: number
    session_kind: 'pt' | 'open_gym' | null
  }

  // Idempotency: a pass_purchase for this member + pack minted in the
  // last 5 minutes means a double-fired provision — return it, and
  // don't grant twice.
  const { data: existing } = await admin
    .from('pass_purchases')
    .select('id')
    .eq('user_id', args.userId)
    .eq('pass_id', args.passId)
    .gte('purchased_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .maybeSingle()
  if (existing) {
    return { ok: true, passPurchaseId: (existing as { id: string }).id }
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + p.validity_days)

  const { data: row, error } = await admin
    .from('pass_purchases')
    .insert({
      user_id: args.userId,
      pass_id: args.passId,
      uses_total: p.uses_total,
      uses_remaining: p.uses_total,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()
  if (error || !row) {
    return { ok: false, error: error?.message ?? 'insert failed' }
  }
  const passPurchaseId = (row as { id: string }).id

  const grant = await grantSessions(admin, {
    userId: args.userId,
    kind: p.session_kind ?? 'pt',
    count: p.uses_total,
    reason: 'pack_purchase',
    passPurchaseId,
    paymentId: args.paymentId,
    expiresAt: expiresAt.toISOString(),
  })
  if (!grant.ok) return { ok: false, error: grant.error, passPurchaseId }
  return { ok: true, passPurchaseId }
}

export async function confirmBookingGroupFromMetadata(
  admin: SupabaseClient,
  args: { bookingGroupId: string }
): Promise<ProvisionResult> {
  const { error: groupErr } = await admin
    .from('booking_groups')
    .update({ status: 'confirmed' })
    .eq('id', args.bookingGroupId)
    .eq('status', 'held')
  if (groupErr) return { ok: false, error: groupErr.message }

  const { error: bookingsErr } = await admin
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('booking_group_id', args.bookingGroupId)
    .eq('status', 'held')
  if (bookingsErr) return { ok: false, error: bookingsErr.message }
  return { ok: true }
}

// The plan's monthly allowances land in the ledger as a hard reset.
// null pt_sessions_per_month = unlimited (entitlement handles it, no
// ledger row); 0 = no PT on this plan.
async function grantPlanMonth(
  admin: SupabaseClient,
  args: { userId: string; planId: string; paymentId?: string | null }
): Promise<void> {
  const { data: plan } = await admin
    .from('plans')
    .select('pt_sessions_per_month, open_gym_visits_per_month')
    .eq('id', args.planId)
    .maybeSingle()
  const p = plan as {
    pt_sessions_per_month: number | null
    open_gym_visits_per_month: number | null
  } | null
  if (!p) return
  if (typeof p.pt_sessions_per_month === 'number' && p.pt_sessions_per_month > 0) {
    await resetMonthlyGrant(admin, {
      userId: args.userId,
      kind: 'pt',
      perMonth: p.pt_sessions_per_month,
      paymentId: args.paymentId ?? null,
    })
  }
  if (
    typeof p.open_gym_visits_per_month === 'number' &&
    p.open_gym_visits_per_month > 0
  ) {
    await resetMonthlyGrant(admin, {
      userId: args.userId,
      kind: 'open_gym',
      perMonth: p.open_gym_visits_per_month,
      paymentId: args.paymentId ?? null,
    })
  }
}

export async function grantSubscriptionFromMetadata(
  admin: SupabaseClient,
  args: {
    userId: string
    planId: string
    paymentId?: string | null
    // Legacy flag from the coworking fork; ignored.
    isVirtualOffice?: boolean
  }
): Promise<ProvisionResult> {
  // Same-plan active subscription → this payment is a renewal: extend
  // the existing row instead of stacking a duplicate. A very recent row
  // (5 min) means a double-fired provision — return it untouched.
  const { data: existingRows } = await admin
    .from('subscriptions')
    .select('id, plan_id, current_period_end, created_at, updated_at')
    .eq('user_id', args.userId)
    .in('status', ['active', 'past_due', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
  const existing = (
    existingRows as
      | {
          id: string
          plan_id: string
          current_period_end: string
          created_at: string
          updated_at: string | null
        }[]
      | null
  )?.[0]

  if (existing) {
    const recentMs = 5 * 60 * 1000
    const isFreshInsert =
      Date.now() - new Date(existing.created_at).getTime() < recentMs
    const isFreshExtend =
      existing.updated_at &&
      Date.now() - new Date(existing.updated_at).getTime() < recentMs
    if (isFreshInsert || isFreshExtend) {
      return { ok: true, subscriptionId: existing.id }
    }
    if (existing.plan_id === args.planId) {
      const oldEnd = new Date(existing.current_period_end)
      const base = oldEnd.getTime() > Date.now() ? oldEnd : new Date()
      const periodEnd = new Date(base)
      periodEnd.setMonth(periodEnd.getMonth() + 1)
      const { error: extendErr } = await admin
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: base.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (extendErr) return { ok: false, error: extendErr.message }
      await grantPlanMonth(admin, args)
      return { ok: true, subscriptionId: existing.id }
    }
    // Different plan while one is active — surface rather than stack.
    return {
      ok: false,
      error: `User already has an active "${existing.plan_id}" subscription`,
    }
  }

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const { data: row, error } = await admin
    .from('subscriptions')
    .insert({
      user_id: args.userId,
      plan_id: args.planId,
      status: 'active',
      started_at: now.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })
    .select('id')
    .single()
  if (error || !row) {
    return { ok: false, error: error?.message ?? 'insert failed' }
  }
  await grantPlanMonth(admin, args)
  return { ok: true, subscriptionId: (row as { id: string }).id }
}
