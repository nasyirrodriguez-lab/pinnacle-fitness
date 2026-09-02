import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  bookingDayKeys,
  loadPtResource,
  loadWindowSlots,
  summarizeDays,
} from '@/lib/booking/pt'

// GET /api/bookings/availability?resourceId=pt-nasyir&date=YYYY-MM-DD
// → { slots, days } for the coach across the booking window; `date`
// picks which day's slots to return in full.
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const resourceId = request.nextUrl.searchParams.get('resourceId') ?? ''
  const date = request.nextUrl.searchParams.get('date') ?? bookingDayKeys()[0]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'invalid_date' }, { status: 400 })
  }

  const admin = createAdminClient()
  const resource = await loadPtResource(admin, resourceId)
  if (!resource) {
    return NextResponse.json({ error: 'resource_not_found' }, { status: 404 })
  }
  const slotsByDay = await loadWindowSlots(admin, resource, user?.id ?? null)
  return NextResponse.json({
    resource: {
      id: resource.id,
      coachName: resource.coach?.displayName ?? resource.name,
      capacity: resource.capacity,
    },
    days: summarizeDays(slotsByDay),
    date,
    slots: slotsByDay.get(date) ?? [],
  })
}
