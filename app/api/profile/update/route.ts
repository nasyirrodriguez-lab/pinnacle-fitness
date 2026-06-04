import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { userId, fullName } = await req.json()

  if (!userId || !fullName) {
    return NextResponse.json({ error: 'Missing userId or fullName' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin.from('profiles').upsert({
    id: userId,
    full_name: fullName,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
