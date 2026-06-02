import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PlanType, MemberStatus } from '@/lib/types'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify caller is admin
  const { data: caller } = await supabase
    .from('members')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, name, plan_type, status }: {
    id: string
    name?: string
    plan_type?: PlanType
    status?: MemberStatus
  } = await req.json()

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (name !== undefined) patch.name = name
  if (plan_type !== undefined) patch.plan_type = plan_type
  if (status !== undefined) patch.status = status

  const { data, error } = await supabase
    .from('members')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, member: data })
}
