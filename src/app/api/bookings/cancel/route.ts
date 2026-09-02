import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { loadGymSettings } from '@/lib/gym/settings'
import { cancelOutcome } from '@/lib/gym/rules'
import { memberAccess } from '@/lib/gym/entitlement'
import { spendSession } from '@/lib/sessions/ledger'
import { parseTstzRange } from '@/lib/booking/slots'
import { isPtResourceId } from '@/lib/booking/pt'
import { createPtBooking, CREATE_BOOKING_MESSAGES } from '@/lib/booking/create'

// POST /api/bookings/cancel { bookingId, reschedule?: { resourceId, startIso } }
// Free outside the cancel window; inside it the session is spent; once
// the slot has started, nothing. With `reschedule`, the new booking is
// made first so a member never loses their spot to a failed rebook.

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  reschedule: z
    .object({
      resourceId: z.string().min(1),
      startIso: z.string().datetime({ offset: true }),
    })
    .optional(),
})

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 })
  }

  let body
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('bookings')
    .select('id, user_id, resource_id, status, during, checked_in_at')
    .eq('id', body.bookingId)
    .maybeSingle()
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const booking = row as {
    id: string
    user_id: string | null
    resource_id: string
    status: string
    during: string
    checked_in_at: string | null
  }
  if (booking.user_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (booking.status !== 'confirmed' || !isPtResourceId(booking.resource_id)) {
    return NextResponse.json(
      { error: 'not_cancellable', message: 'This booking can’t be cancelled.' },
      { status: 409 }
    )
  }
  if (booking.checked_in_at) {
    return NextResponse.json(
      { error: 'already_checked_in', message: 'You’ve already checked in for this one.' },
      { status: 409 }
    )
  }
  const range = parseTstzRange(booking.during)
  if (!range) {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }

  const settings = await loadGymSettings(admin)
  const outcome = cancelOutcome(range.during_lower, settings)
  if (outcome === 'too_late') {
    return NextResponse.json(
      {
        error: 'too_late',
        outcome,
        message: 'The session has started — talk to your coach.',
      },
      { status: 409 }
    )
  }

  // Reschedule: secure the new spot before releasing the old one.
  let newBooking = null
  if (body.reschedule) {
    const created = await createPtBooking(admin, {
      userId: user.id,
      resourceId: body.reschedule.resourceId,
      startIso: body.reschedule.startIso,
      excludeBookingId: booking.id,
    })
    if (!created.ok) {
      return NextResponse.json(
        { error: created.error, message: CREATE_BOOKING_MESSAGES[created.error] },
        { status: created.error === 'failed' ? 500 : 409 }
      )
    }
    newBooking = created.booking
  }

  const { error: updErr } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', booking.id)
    .eq('status', 'confirmed')
  if (updErr) {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }

  let sessionUsed = false
  if (outcome === 'uses_session') {
    const access = await memberAccess(admin, user.id)
    if (!access.ptUnlimited) {
      const spent = await spendSession(admin, {
        userId: user.id,
        kind: 'pt',
        reason: 'late_cancel',
        bookingId: booking.id,
      })
      sessionUsed = spent.ok
    }
  }

  return NextResponse.json({
    ok: true,
    outcome,
    sessionUsed,
    newBooking,
  })
}
