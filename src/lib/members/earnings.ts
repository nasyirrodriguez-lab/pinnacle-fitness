import type { SupabaseClient } from '@supabase/supabase-js'
import { parseTstzRange } from '@/lib/booking/slots'

// Money a coach has EARNED is what they've delivered: each completed
// (or no-show) PT session × the per-session value of whatever the
// member bought. Cash collected is the business's number; this is the
// coach's.

// Per-session value by plan. Unlimited members attribute at the
// 12-Sessions rate — the owners' rule.
const PLAN_SESSION_CENTS: Record<string, number> = {
  'pt-8': 8750,
  'pt-12': 7500,
  unlimited: 7500,
}
const DEFAULT_SESSION_CENTS = 12000 // a single drop-in PT session

export async function perSessionCents(
  admin: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: sub } = await admin
    .from('subscriptions')
    .select('plan_id, current_period_end')
    .eq('user_id', userId)
    .in('status', ['active', 'past_due'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()
  const planId = (sub as { plan_id?: string } | null)?.plan_id
  if (planId && PLAN_SESSION_CENTS[planId] != null) {
    return PLAN_SESSION_CENTS[planId]
  }
  // Otherwise the most recent PT pack they bought.
  const { data: pack } = await admin
    .from('pass_purchases')
    .select('uses_total, passes(price_cents, session_kind)')
    .eq('user_id', userId)
    .order('purchased_at', { ascending: false })
    .limit(5)
  for (const row of (pack as
    | {
        uses_total: number
        passes:
          | { price_cents?: number; session_kind?: string }
          | { price_cents?: number; session_kind?: string }[]
          | null
      }[]
    | null) ?? []) {
    const p = Array.isArray(row.passes) ? (row.passes[0] ?? null) : row.passes
    if (p?.session_kind === 'pt' && p.price_cents && row.uses_total > 0) {
      return Math.round(p.price_cents / row.uses_total)
    }
  }
  return DEFAULT_SESSION_CENTS
}

export interface DeliveredSession {
  bookingId: string
  userId: string
  memberName: string
  startIso: string
  status: string
  cents: number
}

export interface CoachDelivery {
  sessions: DeliveredSession[]
  totalCents: number
  count: number
}

// Everything a coach delivered between two instants (bookings on their
// PT resource that ended completed or no_show, priced per member).
export async function coachDelivery(
  admin: SupabaseClient,
  args: { resourceId: string; fromIso: string; toIso: string }
): Promise<CoachDelivery> {
  const { data } = await admin
    .from('bookings')
    .select(
      'id, user_id, during, status, profiles!bookings_user_id_fkey(full_name, email)'
    )
    .eq('resource_id', args.resourceId)
    .in('status', ['completed', 'no_show'])
    .gte('during', `[${args.fromIso},)`)
    .lt('during', `[${args.toIso},)`)
    .order('during', { ascending: false })
    .limit(1000)
  type Row = {
    id: string
    user_id: string | null
    during: string
    status: string
    profiles:
      | { full_name?: string | null; email?: string }
      | { full_name?: string | null; email?: string }[]
      | null
  }
  const rows = (data as Row[] | null) ?? []
  const priceCache = new Map<string, number>()
  const sessions: DeliveredSession[] = []
  for (const r of rows) {
    if (!r.user_id) continue
    const range = parseTstzRange(r.during)
    if (!range) continue
    if (!priceCache.has(r.user_id)) {
      priceCache.set(r.user_id, await perSessionCents(admin, r.user_id))
    }
    const profRaw = r.profiles
    const prof = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
    sessions.push({
      bookingId: r.id,
      userId: r.user_id,
      memberName: prof?.full_name?.trim() || prof?.email || 'Member',
      startIso: range.during_lower,
      status: r.status,
      cents: priceCache.get(r.user_id) ?? DEFAULT_SESSION_CENTS,
    })
  }
  return {
    sessions,
    totalCents: sessions.reduce((s, x) => s + x.cents, 0),
    count: sessions.length,
  }
}

// AST month bounds as ISO instants.
export function astMonthBounds(monthKey: string): { fromIso: string; toIso: string } {
  const [y, m] = monthKey.split('-').map(Number)
  const next = new Date(Date.UTC(y, m, 1))
  const nextKey = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
  return {
    fromIso: new Date(`${monthKey}-01T00:00:00-04:00`).toISOString(),
    toIso: new Date(`${nextKey}-01T00:00:00-04:00`).toISOString(),
  }
}

export function astMonthKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Port_of_Spain',
    year: 'numeric',
    month: '2-digit',
  })
    .format(d)
    .slice(0, 7)
}

export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function fmtTtd(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  return `${sign}TT$${(Math.abs(cents) / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}
