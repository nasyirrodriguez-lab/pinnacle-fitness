import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  REASONS,
  DURATIONS,
  getReason,
  RECEPTION_STATUS_ID,
} from '@/lib/checkin/reception-status'

// =====================================================================
// Reception "Be Right Back" status, set from the paired iPad kiosk.
//
//   POST   → go away (reason + duration)
//   DELETE → I'm back at the desk
//
// Both are gated by the paired-device cookie (same guard the other kiosk
// routes use) and write with the service-role admin client, which bypasses
// RLS. There is intentionally no user-session requirement: whoever is at the
// front desk on the paired tablet can flip the status.
// =====================================================================

const setSchema = z.object({
  reasonId: z.enum(REASONS.map((r) => r.id) as [string, ...string[]]),
  durationMinutes: z
    .number()
    .int()
    .refine(
      (m) => DURATIONS.some((d) => d.minutes === m),
      'unsupported_duration'
    ),
})

export async function POST(request: NextRequest) {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  let body
  try {
    body = setSchema.parse(await request.json())
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'invalid_request')
        : 'invalid_request'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const reason = getReason(body.reasonId)
  const awaySince = new Date()
  const returnAt = new Date(awaySince.getTime() + body.durationMinutes * 60_000)

  const admin = createAdminClient()
  const { error } = await admin
    .from('reception_status')
    .update({
      is_away: true,
      reason_id: reason.id,
      message: reason.message,
      away_since: awaySince.toISOString(),
      return_at: returnAt.toISOString(),
      set_by_device_id: device.id,
    })
    .eq('id', RECEPTION_STATUS_ID)
  if (error) {
    console.error('[reception-status] set away failed:', error)
    return NextResponse.json({ error: 'status_update_failed' }, { status: 500 })
  }

  return NextResponse.json({
    status: 'away',
    reasonId: reason.id,
    returnAt: returnAt.toISOString(),
  })
}

export async function DELETE() {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('reception_status')
    .update({
      is_away: false,
      reason_id: null,
      message: null,
      away_since: null,
      return_at: null,
      set_by_device_id: device.id,
    })
    .eq('id', RECEPTION_STATUS_ID)
  if (error) {
    console.error('[reception-status] clear failed:', error)
    return NextResponse.json({ error: 'status_update_failed' }, { status: 500 })
  }

  return NextResponse.json({ status: 'here' })
}
