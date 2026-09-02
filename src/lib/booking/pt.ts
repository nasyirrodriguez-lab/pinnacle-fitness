import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildCoachDayGrid,
  DEFAULT_AVAILABILITY,
  type AvailabilityWindow,
  type CoachBlock,
  type CoachSlot,
} from '@/lib/coaches/availability'
import { parseTstzRange } from '@/lib/booking/slots'
import { astDateKey, astTodayKey } from '@/lib/time/ast'

// Server-side helpers for small-group PT booking. A "PT resource" is a
// coach's calendar (pt-nasyir / pt-matthew); slots come from the coach's
// weekly availability minus blocks, capped at the coach's group size.

export const PT_RESOURCE_IDS = ['pt-nasyir', 'pt-matthew'] as const
export const BOOKING_WINDOW_DAYS = 14
export const MAX_UPCOMING_PER_DAY = 2

export interface PtResource {
  id: string
  name: string
  capacity: number
  slotMinutes: number
  coachId: string | null
  coach: {
    id: string
    displayName: string
    slug: string
    bio: string | null
    groupCap: number
  } | null
}

export function isPtResourceId(id: string): boolean {
  return (PT_RESOURCE_IDS as readonly string[]).includes(id)
}

export async function loadPtResources(
  admin: SupabaseClient
): Promise<PtResource[]> {
  const { data } = await admin
    .from('resources')
    .select(
      'id, name, capacity, slot_minutes, coach_id, coaches(id, display_name, slug, bio, group_cap, is_active, display_order)'
    )
    .in('id', [...PT_RESOURCE_IDS])
    .eq('is_bookable', true)
  type Row = {
    id: string
    name: string
    capacity: number
    slot_minutes: number
    coach_id: string | null
    coaches:
      | Record<string, unknown>
      | Record<string, unknown>[]
      | null
  }
  const rows = ((data as Row[] | null) ?? []).map((r) => {
    const raw = Array.isArray(r.coaches) ? (r.coaches[0] ?? null) : r.coaches
    const coach =
      raw && raw.is_active !== false
        ? {
            id: raw.id as string,
            displayName: raw.display_name as string,
            slug: raw.slug as string,
            bio: (raw.bio as string | null) ?? null,
            groupCap: (raw.group_cap as number) ?? r.capacity,
          }
        : null
    return {
      id: r.id,
      name: r.name,
      capacity: coach?.groupCap ?? r.capacity,
      slotMinutes: r.slot_minutes ?? 60,
      coachId: r.coach_id,
      coach,
    }
  })
  // Keep the seeded order: Nasyir, then Matthew.
  return rows.sort(
    (a, b) =>
      PT_RESOURCE_IDS.indexOf(a.id as (typeof PT_RESOURCE_IDS)[number]) -
      PT_RESOURCE_IDS.indexOf(b.id as (typeof PT_RESOURCE_IDS)[number])
  )
}

export async function loadPtResource(
  admin: SupabaseClient,
  resourceId: string
): Promise<PtResource | null> {
  if (!isPtResourceId(resourceId)) return null
  const all = await loadPtResources(admin)
  return all.find((r) => r.id === resourceId) ?? null
}

// A coach's template + blocks. Falls back to the opening-hours template
// until the coach edits their own availability.
export async function loadCoachCalendar(
  admin: SupabaseClient,
  coachId: string | null
): Promise<{ availability: AvailabilityWindow[]; blocks: CoachBlock[] }> {
  if (!coachId) return { availability: DEFAULT_AVAILABILITY, blocks: [] }
  const [{ data: avail }, { data: blocks }] = await Promise.all([
    admin
      .from('coach_availability')
      .select('weekday, start_minute, end_minute')
      .eq('coach_id', coachId),
    admin
      .from('coach_blocks')
      .select('starts_at, ends_at, reason')
      .eq('coach_id', coachId)
      .gte('ends_at', new Date().toISOString()),
  ])
  const availability = (
    (avail as
      | { weekday: number; start_minute: number; end_minute: number }[]
      | null) ?? []
  ).map((a) => ({
    weekday: a.weekday,
    startMinute: a.start_minute,
    endMinute: a.end_minute,
  }))
  return {
    availability: availability.length > 0 ? availability : DEFAULT_AVAILABILITY,
    blocks: (
      (blocks as
        | { starts_at: string; ends_at: string; reason: string | null }[]
        | null) ?? []
    ).map((b) => ({ startsAt: b.starts_at, endsAt: b.ends_at, reason: b.reason })),
  }
}

export interface DaySummary {
  dateKey: string
  open: boolean
  available: number
  mine: boolean
}

export function bookingDayKeys(days = BOOKING_WINDOW_DAYS): string[] {
  const today = astTodayKey()
  const base = new Date(`${today}T12:00:00-04:00`).getTime()
  return Array.from({ length: days }, (_, i) =>
    astDateKey(base + i * 24 * 60 * 60 * 1000)
  )
}

// Every slot for a coach across the booking window, keyed by AST day.
export async function loadWindowSlots(
  admin: SupabaseClient,
  resource: PtResource,
  currentUserId: string | null
): Promise<Map<string, CoachSlot[]>> {
  const keys = bookingDayKeys()
  const from = new Date(`${keys[0]}T00:00:00-04:00`).toISOString()
  const to = new Date(`${keys[keys.length - 1]}T23:59:59.999-04:00`).toISOString()
  const [{ availability, blocks }, { data: bookingRows }] = await Promise.all([
    loadCoachCalendar(admin, resource.coachId),
    admin
      .from('bookings')
      .select('during, user_id')
      .eq('resource_id', resource.id)
      .in('status', ['held', 'confirmed'])
      .gte('during', `[${from},)`)
      .lt('during', `[${to},)`),
  ])
  const byDay = new Map<string, { startIso: string; endIso: string; userId: string | null }[]>()
  for (const row of (bookingRows as { during: string; user_id: string | null }[] | null) ?? []) {
    const range = parseTstzRange(row.during)
    if (!range) continue
    const key = astDateKey(range.during_lower)
    const list = byDay.get(key) ?? []
    list.push({
      startIso: range.during_lower,
      endIso: range.during_upper,
      userId: row.user_id,
    })
    byDay.set(key, list)
  }
  const out = new Map<string, CoachSlot[]>()
  for (const key of keys) {
    out.set(
      key,
      buildCoachDayGrid({
        dateKey: key,
        availability,
        blocks,
        bookings: byDay.get(key) ?? [],
        capacity: resource.capacity,
        slotMinutes: resource.slotMinutes,
        currentUserId,
      })
    )
  }
  return out
}

export function summarizeDays(slotsByDay: Map<string, CoachSlot[]>): DaySummary[] {
  return [...slotsByDay.entries()].map(([dateKey, slots]) => ({
    dateKey,
    open: slots.length > 0,
    available: slots.filter((s) => s.available).length,
    mine: slots.some((s) => s.bookedByMe),
  }))
}

export function nextAvailableSlot(slotsByDay: Map<string, CoachSlot[]>): CoachSlot | null {
  for (const slots of slotsByDay.values()) {
    const s = slots.find((x) => x.available)
    if (s) return s
  }
  return null
}

// Upcoming confirmed PT bookings the member hasn't checked into yet —
// these are "reserved" sessions that count against the balance.
export async function reservedPtCount(
  admin: SupabaseClient,
  userId: string,
  excludeBookingId?: string
): Promise<number> {
  const { data } = await admin
    .from('bookings')
    .select('id, during')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .in('resource_id', [...PT_RESOURCE_IDS])
    .is('checked_in_at', null)
    .gte('during', `[${new Date().toISOString()},)`)
  return ((data as { id: string }[] | null) ?? []).filter(
    (b) => b.id !== excludeBookingId
  ).length
}
