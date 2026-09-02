import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { issueCheckinToken } from '@/lib/checkin/qr'

// Returns a fresh 24h check-in token for the current member. The QR sheet
// calls this on open so the encoded value matches what /my-qr would show.
export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const token = issueCheckinToken(user.id)
  return NextResponse.json({ token })
}
