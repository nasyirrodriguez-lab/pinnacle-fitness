import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  buildDayGrid,
  parseTstzRange,
  type ResourceForBooking,
} from '@/lib/booking/slots'
import { planRoomUsage } from '@/lib/booking/plan-benefits'
import { remainingRoomHours } from '@/lib/booking/room-credits'
import { astStartOfDay, astEndOfDay } from '@/lib/time/ast'

// Admin-only endpoint that returns the slot grid for a resource on a
// given AST date. Used by /admin/bookings/new so the admin can pick
// times the same way a member would, except the admin sees real-name
// conflicts (vs the public grid which just shows "busy").
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || (profile as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'admin_only' }, { status: 403 })
  }

  const resourceId = request.nextUrl.searchParams.get('resourceId')
  const dateParam = request.nextUrl.searchParams.get('date') // YYYY-MM-DD in AST
  if (!resourceId || !dateParam) {
    return NextResponse.json(
      { error: 'resourceId and date required' },
      { status: 400 }
    )
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { error: 'date must be YYYY-MM-DD' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  // No is_bookable filter: admins can place specialized bookings on any
  // resource (matching adminCreateBooking, which never filtered).
  const { data: resourceRow } = await admin
    .from('resources')
    .select(
      'id, name, description, kind, capacity, price_per_hour_cents, after_hours_price_per_hour_cents, after_hours_starts_at_hour, currency, open_hour, close_hour, slot_minutes'
    )
    .eq('id', resourceId)
    .maybeSingle()
  if (!resourceRow) {
    return NextResponse.json({ error: 'resource_not_found' }, { status: 404 })
  }
  const resource = resourceRow as ResourceForBooking
  // Admin bookings can run to 9pm even when the public grid closes
  // earlier; 5pm onward is labeled after-hours in the picker.
  resource.close_hour = Math.max(resource.close_hour ?? 20, 21)

  const dayStart = astStartOfDay(`${dateParam}T00:00:00-04:00`)
  const dayEnd = astEndOfDay(`${dateParam}T00:00:00-04:00`)

  const { data: busyRows } = await admin
    .from('bookings')
    .select('during, user_id, status')
    .eq('resource_id', resourceId)
    .in('status', ['held', 'confirmed'])
    .gte('during', `[${dayStart.toISOString()},)`)
    .lt('during', `[${dayEnd.toISOString()},)`)

  type BusyRow = { during: string; user_id: string | null; status: string }
  const busy = ((busyRows as BusyRow[] | null) ?? [])
    .map((row) => {
      const parsed = parseTstzRange(row.during)
      if (!parsed) return null
      return {
        during_lower: parsed.during_lower,
        during_upper: parsed.during_upper,
        user_id: row.user_id,
      }
    })
    .filter(
      (
        r
      ): r is {
        during_lower: string
        during_upper: string
        user_id: string | null
      } => r !== null
    )

  // Build the day's grid using the same code path the booking page uses.
  // We pass null currentUserId so nothing is flagged as "mine" — admin's
  // own bookings aren't a useful signal here.
  const cells = buildDayGrid({
    resource,
    date: new Date(`${dateParam}T00:00:00-04:00`),
    busy,
    currentUserId: null,
  })

  // When a member is selected, report what their plan + meeting credits
  // could cover on this resource so the form can offer plan coverage.
  const memberId = request.nextUrl.searchParams.get('memberId')
  let memberCoverage: {
    planHoursPerMonth: number
    planHoursUsed: number
    creditHours: number
  } | null = null
  if (memberId && /^[0-9a-f-]{36}$/.test(memberId)) {
    const [usage, creditHours] = await Promise.all([
      planRoomUsage(admin, { userId: memberId, resourceId: resource.id }),
      remainingRoomHours(admin, memberId, resource.id),
    ])
    memberCoverage = {
      planHoursPerMonth: usage?.hoursPerMonth ?? 0,
      planHoursUsed: usage?.hoursUsed ?? 0,
      creditHours,
    }
  }

  return NextResponse.json({
    resource: {
      id: resource.id,
      name: resource.name,
      pricePerHourCents: resource.price_per_hour_cents ?? 0,
      afterHoursPricePerHourCents:
        resource.after_hours_price_per_hour_cents ?? null,
      afterHoursStartsAtHour: resource.after_hours_starts_at_hour ?? 17,
      currency: resource.currency,
      slotMinutes: resource.slot_minutes,
    },
    cells,
    memberCoverage,
  })
}
