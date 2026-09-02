import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { parseTstzRange } from '@/lib/booking/slots'

// GET /api/bookings/:id/ics → a one-event calendar file for the
// member's own PT booking.

function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Sign in first', { status: 401 })

  // RLS: members only read their own bookings.
  const { data } = await supabase
    .from('bookings')
    .select('id, during, resources(name)')
    .eq('id', id)
    .maybeSingle()
  if (!data) return new NextResponse('Not found', { status: 404 })
  const row = data as {
    id: string
    during: string
    resources: { name?: string } | { name?: string }[] | null
  }
  const range = parseTstzRange(row.during)
  if (!range) return new NextResponse('Not found', { status: 404 })
  const resRaw = row.resources
  const coach =
    (Array.isArray(resRaw) ? resRaw[0]?.name : resRaw?.name) ?? 'Pinnacle'

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pinnacle Fitness//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${row.id}@pinnaclefitness.app`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(range.during_lower)}`,
    `DTEND:${icsStamp(range.during_upper)}`,
    `SUMMARY:${coach} — Pinnacle Fitness`,
    'LOCATION:The Playground — Sport & Social\\, 227 Western Main Rd\\, Port of Spain',
    'DESCRIPTION:Scan your QR at the iPad when you arrive.',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="pinnacle-${row.id.slice(0, 8)}.ics"`,
    },
  })
}
