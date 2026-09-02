import type { SupabaseClient } from '@supabase/supabase-js'
import { parseTstzRange } from '@/lib/booking/slots'

// Plan room benefits: a plan can include N hours per month on a given
// room, optionally capped per day. Covered bookings are stamped with
// covered_by_plan so usage is computable from the bookings table alone.

export type BenefitUnit = 'minutes' | 'hours' | 'days' | 'months'

// A "day" of room use counts as 8 hours; "months" means unlimited use
// while the plan month runs (modeled as an effectively-infinite pool).
const DAY_HOURS = 8
const UNLIMITED_HOURS = 100_000

export interface RoomBenefit {
  resourceId: string
  unit: BenefitUnit
  amount: number
  maxHoursPerDay: number | null
}

export function benefitHoursPerMonth(b: RoomBenefit): number {
  switch (b.unit) {
    case 'minutes':
      return b.amount / 60
    case 'hours':
      return b.amount
    case 'days':
      return b.amount * DAY_HOURS
    case 'months':
      return UNLIMITED_HOURS
  }
}

export function parseRoomBenefits(raw: unknown): RoomBenefit[] {
  if (!Array.isArray(raw)) return []
  const out: RoomBenefit[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const r = item as Record<string, unknown>
    const resourceId = r.resourceId
    if (typeof resourceId !== 'string') continue

    // Current shape: {unit, amount}. Legacy shape: {hoursPerMonth}.
    let unit: BenefitUnit = 'hours'
    let amount = 0
    if (
      typeof r.unit === 'string' &&
      ['minutes', 'hours', 'days', 'months'].includes(r.unit) &&
      typeof r.amount === 'number'
    ) {
      unit = r.unit as BenefitUnit
      amount = r.amount
    } else if (typeof r.hoursPerMonth === 'number') {
      unit = 'hours'
      amount = r.hoursPerMonth
    }
    if (amount <= 0) continue

    out.push({
      resourceId,
      unit,
      amount,
      maxHoursPerDay:
        typeof r.maxHoursPerDay === 'number' && r.maxHoursPerDay > 0
          ? r.maxHoursPerDay
          : null,
    })
  }
  return out
}

function astDayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Port_of_Spain',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function astMonthStartIso(): string {
  const key = astDayKey(new Date().toISOString())
  return `${key.slice(0, 8)}01T00:00:00-04:00`
}

export interface SlotInput {
  startIso: string
  endIso: string
}

export interface PlanRoomUsage {
  hoursPerMonth: number
  hoursUsed: number
}

// What the member's plan grants on a resource and how much of it this
// AST month's covered bookings have consumed. Null when the plan has no
// benefit on the resource (or no live subscription).
export async function planRoomUsage(
  admin: SupabaseClient,
  args: { userId: string; resourceId: string }
): Promise<PlanRoomUsage | null> {
  const { data: subRows } = await admin
    .from('subscriptions')
    .select('current_period_end, plans(room_benefits)')
    .eq('user_id', args.userId)
    .in('status', ['active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
  const sub = (
    subRows as
      | {
          current_period_end: string
          plans:
            | { room_benefits?: unknown }
            | { room_benefits?: unknown }[]
            | null
        }[]
      | null
  )?.[0]
  if (!sub || new Date(sub.current_period_end).getTime() < Date.now()) {
    return null
  }
  const planRaw = sub.plans
  const plan = Array.isArray(planRaw) ? (planRaw[0] ?? null) : planRaw
  const benefit = parseRoomBenefits(plan?.room_benefits).find(
    (b) => b.resourceId === args.resourceId
  )
  if (!benefit) return null

  const { data: usedRows } = await admin
    .from('bookings')
    .select('during')
    .eq('user_id', args.userId)
    .eq('resource_id', args.resourceId)
    .eq('covered_by_plan', true)
    .in('status', ['held', 'confirmed'])
    .gte('during', `[${new Date(astMonthStartIso()).toISOString()},)`)
  let hoursUsed = 0
  for (const row of (usedRows as { during: string }[] | null) ?? []) {
    const range = parseTstzRange(row.during)
    if (!range) continue
    hoursUsed +=
      (new Date(range.during_upper).getTime() -
        new Date(range.during_lower).getTime()) /
      (60 * 60 * 1000)
  }
  return { hoursPerMonth: benefitHoursPerMonth(benefit), hoursUsed }
}

export interface CoverageResult {
  // Index-aligned with the input slots: true = free under the plan.
  covered: boolean[]
  coveredHours: number
}

// Decide which of the requested slots the member's plan covers, given
// what they've already used this AST month (and per-day caps).
export async function computePlanCoverage(
  admin: SupabaseClient,
  args: { userId: string; resourceId: string; slots: SlotInput[] }
): Promise<CoverageResult> {
  const none: CoverageResult = {
    covered: args.slots.map(() => false),
    coveredHours: 0,
  }

  const { data: subRows } = await admin
    .from('subscriptions')
    .select('current_period_end, plans(room_benefits)')
    .eq('user_id', args.userId)
    .in('status', ['active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
  const sub = (
    subRows as
      | {
          current_period_end: string
          plans:
            | { room_benefits?: unknown }
            | { room_benefits?: unknown }[]
            | null
        }[]
      | null
  )?.[0]
  if (!sub) return none
  // A lapsed membership gets no room hours until it's renewed.
  if (new Date(sub.current_period_end).getTime() < Date.now()) return none

  const planRaw = sub.plans
  const plan = Array.isArray(planRaw) ? (planRaw[0] ?? null) : planRaw
  const benefit = parseRoomBenefits(plan?.room_benefits).find(
    (b) => b.resourceId === args.resourceId
  )
  if (!benefit) return none

  // Usage this month: covered bookings on this resource, held/confirmed.
  const { data: usedRows } = await admin
    .from('bookings')
    .select('during')
    .eq('user_id', args.userId)
    .eq('resource_id', args.resourceId)
    .eq('covered_by_plan', true)
    .in('status', ['held', 'confirmed'])
    .gte('during', `[${new Date(astMonthStartIso()).toISOString()},)`)

  let usedMonthHours = 0
  const usedByDay = new Map<string, number>()
  for (const row of (usedRows as { during: string }[] | null) ?? []) {
    const range = parseTstzRange(row.during)
    if (!range) continue
    const hours =
      (new Date(range.during_upper).getTime() -
        new Date(range.during_lower).getTime()) /
      (60 * 60 * 1000)
    usedMonthHours += hours
    const day = astDayKey(range.during_lower)
    usedByDay.set(day, (usedByDay.get(day) ?? 0) + hours)
  }

  let remaining = benefitHoursPerMonth(benefit) - usedMonthHours
  const covered: boolean[] = []
  let coveredHours = 0

  // Chronological order so earlier slots claim the hours first.
  const order = args.slots
    .map((slot, index) => ({ slot, index }))
    .sort(
      (a, b) =>
        new Date(a.slot.startIso).getTime() -
        new Date(b.slot.startIso).getTime()
    )
  const result = args.slots.map(() => false)
  for (const { slot, index } of order) {
    const hours =
      (new Date(slot.endIso).getTime() - new Date(slot.startIso).getTime()) /
      (60 * 60 * 1000)
    const day = astDayKey(slot.startIso)
    const dayUsed = usedByDay.get(day) ?? 0
    const dayOk =
      benefit.maxHoursPerDay === null ||
      dayUsed + hours <= benefit.maxHoursPerDay
    if (hours <= remaining && dayOk) {
      result[index] = true
      remaining -= hours
      coveredHours += hours
      usedByDay.set(day, dayUsed + hours)
    }
  }

  covered.push(...result)
  return { covered, coveredHours }
}
