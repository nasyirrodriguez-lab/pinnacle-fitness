import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/classes/book  { classId }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { classId } = await req.json()
  if (!classId) return NextResponse.json({ error: 'Missing classId' }, { status: 400 })

  // Get the member row
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Check class capacity
  const { count } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId)
    .eq('status', 'confirmed')

  const { data: gymClass } = await supabase
    .from('classes')
    .select('max_spots')
    .eq('id', classId)
    .single()

  if (gymClass && count !== null && count >= gymClass.max_spots) {
    return NextResponse.json({ error: 'Class is full' }, { status: 409 })
  }

  // Upsert booking (re-confirm if previously cancelled)
  const { error } = await supabase
    .from('bookings')
    .upsert(
      { class_id: classId, member_id: member.id, status: 'confirmed', booked_at: new Date().toISOString() },
      { onConflict: 'class_id,member_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
