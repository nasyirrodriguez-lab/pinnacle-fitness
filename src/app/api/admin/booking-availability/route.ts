import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isTeam } from '@/lib/auth/roles'
import { loadPtResource, loadWindowSlots } from '@/lib/booking/pt'
import { memberAccess } from '@/lib/gym/entitlement'

// Team-only: a coach's slot grid for the on-behalf booking form, plus
// the chosen member's PT balance so the form can warn before booking.
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || !isTeam((profile as { role?: string }).role)) {
    return NextResponse.json({ error: 'team_only' }, { status: 403 })
  }

  const resourceId = request.nextUrl.searchParams.get('resourceId')
  const memberId = request.nextUrl.searchParams.get('memberId')
  if (!resourceId) {
    return NextResponse.json({ error: 'resourceId required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const resource = await loadPtResource(admin, resourceId)
  if (!resource) {
    return NextResponse.json({ error: 'resource_not_found' }, { status: 404 })
  }
  const slotsByDay = await loadWindowSlots(admin, resource, memberId)
  const days = [...slotsByDay.entries()].map(([dateKey, slots]) => ({
    dateKey,
    slots,
  }))

  let member: { ptBalance: number; ptUnlimited: boolean; plan: string | null } | null =
    null
  if (memberId && /^[0-9a-f-]{36}$/.test(memberId)) {
    const access = await memberAccess(admin, memberId)
    member = {
      ptBalance: access.ptBalance,
      ptUnlimited: access.ptUnlimited,
      plan: access.plan?.name ?? null,
    }
  }

  return NextResponse.json({
    resource: { id: resource.id, name: resource.name, capacity: resource.capacity },
    days,
    member,
  })
}
