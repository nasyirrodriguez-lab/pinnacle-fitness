import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { floorStatus } from '@/lib/gym/floor'

// GET /api/bookings/floor → live open-gym headcount. No PII, so it is
// fine unauthenticated: members check it before they leave home.
export async function GET() {
  const status = await floorStatus(createAdminClient())
  return NextResponse.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
