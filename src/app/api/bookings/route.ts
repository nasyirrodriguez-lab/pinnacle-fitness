import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createPtBooking, CREATE_BOOKING_MESSAGES } from '@/lib/booking/create'

// POST /api/bookings { resourceId, startIso } → reserve a spot in a
// coach's small-group hour.

const bodySchema = z.object({
  resourceId: z.string().min(1),
  startIso: z.string().datetime({ offset: true }),
})

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'not_signed_in', message: CREATE_BOOKING_MESSAGES.not_signed_in },
      { status: 401 }
    )
  }

  let body
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: CREATE_BOOKING_MESSAGES.invalid_request },
      { status: 400 }
    )
  }

  const result = await createPtBooking(createAdminClient(), {
    userId: user.id,
    resourceId: body.resourceId,
    startIso: body.startIso,
  })
  if (!result.ok) {
    const status =
      result.error === 'resource_not_found'
        ? 404
        : result.error === 'failed'
          ? 500
          : 409
    return NextResponse.json(
      { error: result.error, message: CREATE_BOOKING_MESSAGES[result.error] },
      { status }
    )
  }
  return NextResponse.json({ ok: true, booking: result.booking })
}
