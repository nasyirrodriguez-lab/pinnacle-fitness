import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { trainer } = await req.json()
  if (!trainer) return NextResponse.json({ error: 'Missing trainer' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').upsert(
    { id: user.id, trainer },
    { onConflict: 'id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
