import type { SupabaseClient } from '@supabase/supabase-js'
import { memberAccess } from '@/lib/gym/entitlement'
import { astDateKey, fmtAstTime, fmtAstWeekdayDate } from '@/lib/time/ast'
import {
  bookingDayKeys,
  loadPtResource,
  loadWindowSlots,
  MAX_UPCOMING_PER_DAY,
  reservedPtCount,
} from '@/lib/booking/pt'

// Creating a PT booking, shared by POST /api/bookings and the
// reschedule path in /api/bookings/cancel. Nothing is charged here: the
// PT session is spent when the member scans in at the iPad.

export type CreateBookingError =
  | 'not_signed_in'
  | 'invalid_request'
  | 'resource_not_found'
  | 'outside_window'
  | 'slot_unavailable'
  | 'slot_full'
  | 'already_booked'
  | 'day_limit'
  | 'no_sessions'
  | 'failed'

export const CREATE_BOOKING_MESSAGES: Record<CreateBookingError, string> = {
  not_signed_in: 'Sign in to book.',
  invalid_request: 'That request didn’t make sense — try again.',
  resource_not_found: 'That coach isn’t taking bookings right now.',
  outside_window: 'You can book up to two weeks ahead.',
  slot_unavailable: 'That hour isn’t open. Pick another.',
  slot_full: 'That hour just filled up. Pick another.',
  already_booked: 'You’re already in that session.',
  day_limit: 'Two PT sessions a day is the max. Spread them out.',
  no_sessions:
    'You’ve reserved all your sessions — top up a pack or wait for your plan to renew.',
  failed: 'Could not save the booking. Try again.',
}

export interface CreatedBooking {
  id: string
  resourceId: string
  coachName: string
  startIso: string
  endIso: string
  dayLabel: string
  timeLabel: string
}

// Shared with /api/bookings/cancel (reschedule). Returns the booking or
// a typed error; `excludeBookingId` keeps a booking being rescheduled
// out of the reserved count and the per-day limit.
export async function createPtBooking(
  admin: SupabaseClient,
  args: {
    userId: string
    resourceId: string
    startIso: string
    excludeBookingId?: string
  }
): Promise<
  { ok: true; booking: CreatedBooking } | { ok: false; error: CreateBookingError }
> {
  const resource = await loadPtResource(admin, args.resourceId)
  if (!resource) return { ok: false, error: 'resource_not_found' }

  const startMs = new Date(args.startIso).getTime()
  if (Number.isNaN(startMs)) return { ok: false, error: 'invalid_request' }
  const dateKey = astDateKey(startMs)
  if (!bookingDayKeys().includes(dateKey)) {
    return { ok: false, error: 'outside_window' }
  }

  const slotsByDay = await loadWindowSlots(admin, resource, args.userId)
  const slot = (slotsByDay.get(dateKey) ?? []).find(
    (s) => new Date(s.startIso).getTime() === startMs
  )
  if (!slot) return { ok: false, error: 'slot_unavailable' }
  if (slot.bookedByMe) return { ok: false, error: 'already_booked' }
  if (slot.isPast) return { ok: false, error: 'slot_unavailable' }
  if (slot.isFull) return { ok: false, error: 'slot_full' }

  // Per-day cap across both coaches.
  const { data: sameDay } = await admin
    .from('bookings')
    .select('id')
    .eq('user_id', args.userId)
    .eq('status', 'confirmed')
    .in('resource_id', ['pt-nasyir', 'pt-matthew'])
    .gte('during', `[${new Date(`${dateKey}T00:00:00-04:00`).toISOString()},)`)
    .lt('during', `[${new Date(`${dateKey}T23:59:59.999-04:00`).toISOString()},)`)
  const dayCount = ((sameDay as { id: string }[] | null) ?? []).filter(
    (b) => b.id !== args.excludeBookingId
  ).length
  if (dayCount >= MAX_UPCOMING_PER_DAY) return { ok: false, error: 'day_limit' }

  // Sessions: unlimited plans book freely; everyone else can only hold
  // as many upcoming sessions as they have left.
  const access = await memberAccess(admin, args.userId)
  if (!access.ptUnlimited) {
    const reserved = await reservedPtCount(admin, args.userId, args.excludeBookingId)
    if (access.ptBalance - reserved <= 0) {
      return { ok: false, error: 'no_sessions' }
    }
  }

  const { data: group, error: groupErr } = await admin
    .from('booking_groups')
    .insert({
      user_id: args.userId,
      total_cents: 0,
      currency: 'TTD',
      status: 'confirmed',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()
  if (groupErr || !group) {
    console.error('[bookings] group insert failed:', groupErr)
    return { ok: false, error: 'failed' }
  }
  const groupId = (group as { id: string }).id

  const { data: booking, error: bookingErr } = await admin
    .from('bookings')
    .insert({
      user_id: args.userId,
      resource_id: resource.id,
      during: `[${slot.startIso},${slot.endIso})`,
      status: 'confirmed',
      price_cents: 0,
      booking_group_id: groupId,
      covered_by_plan: true,
    })
    .select('id')
    .single()
  if (bookingErr || !booking) {
    await admin.from('booking_groups').delete().eq('id', groupId)
    const code = (bookingErr as { code?: string } | null)?.code
    if (code === '23514') return { ok: false, error: 'slot_full' }
    console.error('[bookings] insert failed:', bookingErr)
    return { ok: false, error: 'failed' }
  }

  return {
    ok: true,
    booking: {
      id: (booking as { id: string }).id,
      resourceId: resource.id,
      coachName: resource.coach?.displayName ?? resource.name,
      startIso: slot.startIso,
      endIso: slot.endIso,
      dayLabel: fmtAstWeekdayDate(slot.startIso),
      timeLabel: fmtAstTime(slot.startIso),
    },
  }
}

