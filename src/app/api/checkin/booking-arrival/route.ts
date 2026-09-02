import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { createAdminClient } from '@/utils/supabase/admin'
import { checkInBookingRunArrival } from '@/lib/booking/arrival'
import { parseTstzRange } from '@/lib/booking/slots'
import { astStartOfDay, astEndOfDay } from '@/lib/time/ast'

// =====================================================================
// Kiosk "here for a booking" flow.
//   GET  → today's confirmed bookings not yet checked in
//   POST → check one in (stamps the booking + logs a visit)
// Gated by the paired-device cookie, same trust model as check-in.
// =====================================================================

export async function GET() {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const dayStart = astStartOfDay(now)
  const dayEnd = astEndOfDay(now)

  const { data, error } = await admin
    .from('bookings')
    .select(
      'id, during, guest_name, checked_in_at, group_size, checkin_count, user_id, booking_group_id, resource_id, resources(name), profiles(full_name, email)'
    )
    .eq('status', 'confirmed')
    .gte('during', `[${dayStart.toISOString()},)`)
    .lt('during', `[${dayEnd.toISOString()},)`)
    .order('during', { ascending: true })
    .limit(120)

  if (error) {
    console.error('[checkin/booking-arrival] list failed:', error)
    return NextResponse.json({ error: 'list_failed' }, { status: 500 })
  }

  type Row = {
    id: string
    during: string
    guest_name: string | null
    checked_in_at: string | null
    group_size: number | null
    checkin_count: number
    user_id: string | null
    booking_group_id: string | null
    resource_id: string
    resources: { name?: string } | { name?: string }[] | null
    profiles:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null
  }

  interface MergedEntry {
    id: string
    ids: string[]
    displayName: string
    resourceName: string
    startIso: string | null
    endIso: string | null
    groupSize: number
    checkedIn: number
    groupKey: string | null
    resourceId: string
  }

  // One meeting = one tile: fold contiguous slots of the same booking
  // group + resource into a single entry the whole run checks in against.
  const merged: MergedEntry[] = []
  for (const r of (data as Row[] | null) ?? []) {
    const range = parseTstzRange(r.during)
    const resRaw = r.resources
    const profRaw = r.profiles
    const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
    const entry: MergedEntry = {
      id: r.id,
      ids: [r.id],
      displayName:
        profile?.full_name?.trim() ||
        r.guest_name ||
        profile?.email ||
        'Visitor',
      resourceName:
        (Array.isArray(resRaw) ? resRaw[0]?.name : resRaw?.name) ?? 'Room',
      startIso: range?.during_lower ?? null,
      endIso: range?.during_upper ?? null,
      groupSize: r.group_size ?? 1,
      checkedIn: r.checkin_count,
      groupKey: r.booking_group_id,
      resourceId: r.resource_id,
    }
    const prev = merged[merged.length - 1]
    if (
      prev &&
      prev.groupKey &&
      prev.groupKey === entry.groupKey &&
      prev.resourceId === entry.resourceId &&
      prev.endIso &&
      entry.startIso &&
      prev.endIso === entry.startIso
    ) {
      prev.ids.push(r.id)
      prev.endIso = entry.endIso
      prev.checkedIn = Math.max(prev.checkedIn, entry.checkedIn)
      continue
    }
    merged.push(entry)
  }

  const bookings = merged
    .filter((e) => e.checkedIn < e.groupSize)
    .map(({ groupKey, resourceId, ...rest }) => {
      void groupKey
      void resourceId
      return rest
    })

  return NextResponse.json({ bookings })
}

const arriveSchema = z
  .object({
    bookingId: z.string().uuid().optional(),
    bookingIds: z.array(z.string().uuid()).min(1).max(30).optional(),
  })
  .refine((v) => v.bookingId || v.bookingIds, 'bookingId required')

export async function POST(request: NextRequest) {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  let body
  try {
    body = arriveSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const ids = body.bookingIds ?? (body.bookingId ? [body.bookingId] : [])
  const result = await checkInBookingRunArrival(admin, ids)
  if (!result.ok) {
    const status =
      result.error === 'not_found'
        ? 404
        : result.error === 'already_checked_in'
          ? 409
          : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({
    status: 'checked_in',
    displayName: result.displayName,
    checkedIn: result.checkedIn,
    groupSize: result.groupSize,
  })
}
