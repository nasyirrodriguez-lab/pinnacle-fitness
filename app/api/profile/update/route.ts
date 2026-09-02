import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { userId, fullName, memberCode, trainer } = await req.json()

  if (!userId || !fullName || !memberCode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  const profileData: Record<string, string> = { id: userId, full_name: fullName }
  if (trainer) profileData.trainer = trainer

  const { error: profileError } = await admin.from('profiles').upsert(
    profileData,
    { onConflict: 'id' }
  )
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // members: user_id, member_code only
  const { error: memberError } = await admin.from('members').upsert(
    { user_id: userId, member_code: memberCode },
    { onConflict: 'user_id', ignoreDuplicates: true }
  )
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
