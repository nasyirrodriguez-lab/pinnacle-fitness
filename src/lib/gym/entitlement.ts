import type { SupabaseClient } from '@supabase/supabase-js'
import { sessionBalance } from '@/lib/sessions/ledger'
import { loadGymSettings } from '@/lib/gym/settings'

// What a member is allowed to do right now, in one object. Built from
// their live subscription (plan rules) plus the session ledger (packs
// and the current month's plan sessions). Every gate — the iPad, the
// booking page, the dashboard — reads this instead of re-deriving it.

export interface PlanRules {
  id: string
  name: string
  // null = unlimited PT, 0 = no PT on this plan
  ptSessionsPerMonth: number | null
  includesOpenGym: boolean
  openGymVisitsPerMonth: number | null
}

export interface MemberAccess {
  plan: PlanRules | null
  subscriptionStatus: 'none' | 'active' | 'grace' | 'lapsed' | 'paused'
  periodEnd: string | null
  lapsedDays: number
  ptUnlimited: boolean
  openGymUnlimited: boolean
  ptBalance: number
  openGymBalance: number
  canTrainPt: boolean
  canUseOpenGym: boolean
}

export async function memberAccess(
  admin: SupabaseClient,
  userId: string
): Promise<MemberAccess> {
  const [settings, { data: subRows }, ptBalance, openGymBalance] =
    await Promise.all([
      loadGymSettings(admin),
      admin
        .from('subscriptions')
        .select(
          'status, current_period_end, plans(id, name, pt_sessions_per_month, includes_open_gym, open_gym_visits_per_month)'
        )
        .eq('user_id', userId)
        .in('status', ['active', 'past_due', 'paused'])
        .order('current_period_end', { ascending: false })
        .limit(1),
      sessionBalance(admin, userId, 'pt'),
      sessionBalance(admin, userId, 'open_gym'),
    ])

  const sub = (
    subRows as
      | {
          status: string
          current_period_end: string
          plans: Record<string, unknown> | Record<string, unknown>[] | null
        }[]
      | null
  )?.[0]

  let plan: PlanRules | null = null
  let subscriptionStatus: MemberAccess['subscriptionStatus'] = 'none'
  let periodEnd: string | null = null
  let lapsedDays = 0
  if (sub) {
    const raw = Array.isArray(sub.plans) ? (sub.plans[0] ?? null) : sub.plans
    if (raw) {
      plan = {
        id: raw.id as string,
        name: raw.name as string,
        ptSessionsPerMonth:
          (raw.pt_sessions_per_month as number | null) ?? null,
        includesOpenGym: (raw.includes_open_gym as boolean) ?? false,
        openGymVisitsPerMonth:
          (raw.open_gym_visits_per_month as number | null) ?? null,
      }
    }
    periodEnd = sub.current_period_end
    const overdueMs = Date.now() - new Date(sub.current_period_end).getTime()
    if (sub.status === 'paused') subscriptionStatus = 'paused'
    else if (overdueMs <= 0) subscriptionStatus = 'active'
    else {
      lapsedDays = Math.floor(overdueMs / (24 * 60 * 60 * 1000))
      subscriptionStatus =
        lapsedDays < settings.lapseGraceDays ? 'grace' : 'lapsed'
    }
  }

  const planLive =
    subscriptionStatus === 'active' || subscriptionStatus === 'grace'
  const ptUnlimited = planLive && plan?.ptSessionsPerMonth === null
  const openGymUnlimited = planLive && plan?.includesOpenGym === true

  return {
    plan,
    subscriptionStatus,
    periodEnd,
    lapsedDays,
    ptUnlimited: Boolean(ptUnlimited),
    openGymUnlimited,
    ptBalance,
    openGymBalance,
    canTrainPt: Boolean(ptUnlimited) || ptBalance > 0,
    canUseOpenGym: openGymUnlimited || openGymBalance > 0,
  }
}

// Human copy for the amber/red screens. Tells the member what's short
// and what fixes it, in one line.
export function accessShortfall(
  access: MemberAccess,
  kind: 'pt' | 'open_gym'
): { title: string; body: string } {
  if (access.subscriptionStatus === 'lapsed') {
    return {
      title: 'Your plan has lapsed',
      body: `Your ${access.plan?.name ?? 'membership'} renewal is ${access.lapsedDays} days overdue. Renew to get back on the floor.`,
    }
  }
  if (access.subscriptionStatus === 'paused') {
    return {
      title: 'Your plan is paused',
      body: 'Ask a coach to reactivate it, or pick up a pack to train today.',
    }
  }
  if (kind === 'pt') {
    return {
      title: 'No PT sessions left',
      body: 'Top up with a pack, or wait for your plan to renew.',
    }
  }
  return {
    title: 'No open-gym visits left',
    body: 'Grab an open-gym pack, or add open gym to your plan.',
  }
}
