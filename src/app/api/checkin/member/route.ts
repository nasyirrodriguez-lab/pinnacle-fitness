import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { verifyCheckinToken } from '@/lib/checkin/qr'
import { createAdminClient } from '@/utils/supabase/admin'
import { gymCheckIn } from '@/lib/checkin/gym-checkin'

// Kiosk member check-in: resolve who's scanning (QR token, or name + PIN
// when their phone is dead), then hand off to the shared door logic.

const bodySchema = z
  .object({
    token: z.string().min(1).optional(),
    userId: z.string().uuid().optional(),
    pin: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
  })
  .refine((v) => Boolean(v.token || v.userId), {
    message: 'token or userId required',
  })

export async function POST(request: NextRequest) {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  let body
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  let userId: string | null = null
  if (body.token) {
    const payload = verifyCheckinToken(body.token)
    if (!payload) {
      return NextResponse.json({ error: 'invalid_qr' }, { status: 400 })
    }
    userId = payload.uid
  } else if (body.userId) {
    userId = body.userId
  }
  if (!userId) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, role, designation, pin_code, archived')
    .eq('id', userId)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json({ error: 'unknown_member' }, { status: 404 })
  }
  const member = profile as {
    id: string
    full_name: string | null
    email: string
    role: string
    designation: string | null
    pin_code: string | null
    archived: boolean
  }
  if (member.archived) {
    return NextResponse.json({ error: 'unknown_member' }, { status: 404 })
  }

  // Name search (no QR) must be backed by the member's PIN.
  if (!body.token) {
    if (!member.pin_code) {
      return NextResponse.json({ error: 'pin_not_set' }, { status: 403 })
    }
    if (body.pin !== member.pin_code) {
      return NextResponse.json({ error: 'pin_mismatch' }, { status: 403 })
    }
  }

  const result = await gymCheckIn(admin, { member, deviceId: device.id })
  if (result.status === 'error') {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json(result)
}
