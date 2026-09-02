import type { SupabaseClient } from '@supabase/supabase-js'

// Shared booking-arrival check-in used by the admin bookings page and
// the kiosk "here for a booking" flow. Stamps checked_in_at on the
// booking and mirrors the arrival into the visits feed so the live
// overview and "currently here" counts stay truthful.
//
// Group bookings (group_size set) accept multiple arrivals: each tap
// bumps checkin_count and logs its own visit; the booking stays on the
// kiosk list until the whole group is in.

export type BookingArrivalResult =
  | { ok: true; displayName: string; checkedIn: number; groupSize: number }
  | { ok: false; error: 'not_found' | 'already_checked_in' | 'failed' }

// A merged run of contiguous slots (one meeting shown as one kiosk
// tile) checks in as a unit: one tap = one person arrived, counted
// against every slot row so they stay in sync, and logged as ONE visit.
export async function checkInBookingRunArrival(
  admin: SupabaseClient,
  bookingIds: string[]
): Promise<BookingArrivalResult> {
  if (bookingIds.length === 0) return { ok: false, error: 'not_found' }
  if (bookingIds.length === 1) {
    return checkInBookingArrival(admin, bookingIds[0])
  }

  const { data: rows } = await admin
    .from('bookings')
    .select(
      'id, user_id, guest_name, guest_email, checked_in_at, group_size, checkin_count, resources(name), profiles(full_name, email)'
    )
    .in('id', bookingIds)
  type RunRow = {
    id: string
    user_id: string | null
    guest_name: string | null
    guest_email: string | null
    checked_in_at: string | null
    group_size: number | null
    checkin_count: number
    resources: { name?: string } | { name?: string }[] | null
    profiles:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null
  }
  const run = (rows as RunRow[] | null) ?? []
  if (run.length === 0) return { ok: false, error: 'not_found' }

  const first = run[0]
  const groupSize = first.group_size ?? 1
  const current = Math.max(...run.map((r) => r.checkin_count))
  if (current >= groupSize) return { ok: false, error: 'already_checked_in' }

  const resRaw = first.resources
  const resourceName =
    (Array.isArray(resRaw) ? resRaw[0]?.name : resRaw?.name) ?? 'room'
  const profRaw = first.profiles
  const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
  const displayName =
    profile?.full_name?.trim() ||
    first.guest_name ||
    profile?.email ||
    'Visitor'

  const nextCount = current + 1
  const nowIso = new Date().toISOString()
  for (const row of run) {
    await admin
      .from('bookings')
      .update({
        checkin_count: nextCount,
        ...(row.checked_in_at ? {} : { checked_in_at: nowIso }),
      })
      .eq('id', row.id)
  }

  const isFirstMemberArrival = first.user_id && nextCount === 1
  const { error: visitErr } = await admin.from('visits').insert(
    isFirstMemberArrival
      ? {
          user_id: first.user_id,
          kind: 'member',
          reason: `booking · ${resourceName}`,
        }
      : {
          kind: 'guest',
          guest_name:
            groupSize > 1
              ? `${displayName} — group ${nextCount}/${groupSize}`
              : (first.guest_name ?? 'Booking guest'),
          guest_email: first.guest_email,
          reason: `booking · ${resourceName}`,
        }
  )
  if (visitErr) {
    console.warn('[booking/arrival] run visit insert failed:', visitErr)
  }

  return { ok: true, displayName, checkedIn: nextCount, groupSize }
}

export async function checkInBookingArrival(
  admin: SupabaseClient,
  bookingId: string
): Promise<BookingArrivalResult> {
  const { data: row } = await admin
    .from('bookings')
    .select(
      'id, user_id, guest_name, guest_email, checked_in_at, group_size, checkin_count, resources(name), profiles(full_name, email)'
    )
    .eq('id', bookingId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'not_found' }

  const booking = row as {
    id: string
    user_id: string | null
    guest_name: string | null
    guest_email: string | null
    checked_in_at: string | null
    group_size: number | null
    checkin_count: number
    resources: { name?: string } | { name?: string }[] | null
    profiles:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null
  }
  const groupSize = booking.group_size ?? 1
  if (booking.checkin_count >= groupSize) {
    return { ok: false, error: 'already_checked_in' }
  }

  const resRaw = booking.resources
  const resourceName =
    (Array.isArray(resRaw) ? resRaw[0]?.name : resRaw?.name) ?? 'room'
  const profRaw = booking.profiles
  const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
  const displayName =
    profile?.full_name?.trim() ||
    booking.guest_name ||
    profile?.email ||
    'Visitor'

  const nextCount = booking.checkin_count + 1
  const { data: updated, error: updateErr } = await admin
    .from('bookings')
    .update({
      checkin_count: nextCount,
      ...(booking.checked_in_at
        ? {}
        : { checked_in_at: new Date().toISOString() }),
    })
    .eq('id', bookingId)
    .eq('checkin_count', booking.checkin_count)
    .select('id')
    .maybeSingle()
  if (updateErr || !updated) {
    if (!updated && !updateErr)
      return { ok: false, error: 'already_checked_in' }
    console.error('[booking/arrival] update failed:', updateErr)
    return { ok: false, error: 'failed' }
  }

  // First arrival on a member booking logs the member; every other
  // arrival (and all guest-booking arrivals) logs a named guest visit
  // so headcounts stay honest.
  const isFirstMemberArrival = booking.user_id && nextCount === 1
  const { error: visitErr } = await admin.from('visits').insert(
    isFirstMemberArrival
      ? {
          user_id: booking.user_id,
          kind: 'member',
          reason: `booking · ${resourceName}`,
        }
      : {
          kind: 'guest',
          guest_name:
            groupSize > 1
              ? `${displayName} — group ${nextCount}/${groupSize}`
              : (booking.guest_name ?? 'Booking guest'),
          guest_email: booking.guest_email,
          reason: `booking · ${resourceName}`,
        }
  )
  if (visitErr) {
    console.warn('[booking/arrival] visit insert failed:', visitErr)
  }

  return { ok: true, displayName, checkedIn: nextCount, groupSize }
}
