import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CheckInMethod } from '@/lib/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { memberCode, method = 'manual' }: { memberCode: string; method?: CheckInMethod } = await req.json()
  if (!memberCode) return NextResponse.json({ error: 'memberCode required' }, { status: 400 })

  // Look up member by their human-readable member_id
  const { data: member, error: lookupErr } = await supabase
    .from('members')
    .select('id, name, member_id, status')
    .eq('member_id', memberCode.trim().toUpperCase())
    .single()

  if (lookupErr || !member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }
  if (member.status === 'suspended') {
    return NextResponse.json({ error: 'Member is suspended', member }, { status: 403 })
  }

  const { data: checkIn, error: insertErr } = await supabase
    .from('check_ins')
    .insert({
      member_id: member.id,
      member_code: member.member_id,
      member_name: member.name,
      method,
      checked_in_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ success: true, checkIn, member })
}
