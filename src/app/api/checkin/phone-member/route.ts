import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { gymCheckIn } from '@/lib/checkin/gym-checkin'

// Self-serve check-in from the member's own phone (they scanned the
// kiosk's QR). Same door logic as the iPad; the trust is the signed-in
// session instead of the paired device.
export async function POST() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, role, designation, archived')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || (profile as { archived: boolean }).archived) {
    return NextResponse.json({ error: 'unknown_member' }, { status: 404 })
  }
  const result = await gymCheckIn(admin, {
    member: profile as {
      id: string
      full_name: string | null
      email: string
      role: string
      designation: string | null
    },
    deviceId: null,
  })
  if (result.status === 'error') {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json(result)
}
