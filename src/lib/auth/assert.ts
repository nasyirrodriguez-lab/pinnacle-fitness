import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { isOwner, isStaff, isTeam } from '@/lib/auth/roles'

// Shared gate for server actions. Returns the caller's id on success so
// actions can stamp who did what.
export type AssertResult = { adminId: string; role: string } | { error: string }

async function callerRole(): Promise<
  { id: string; role: string } | { error: string }
> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  return { id: user.id, role: (profile as { role?: string } | null)?.role ?? 'member' }
}

export async function assertOwner(): Promise<AssertResult> {
  const c = await callerRole()
  if ('error' in c) return c
  if (!isOwner(c.role)) return { error: 'Owners only' }
  return { adminId: c.id, role: c.role }
}

export async function assertTeam(): Promise<AssertResult> {
  const c = await callerRole()
  if ('error' in c) return c
  if (!isTeam(c.role)) return { error: 'Coaches and owners only' }
  return { adminId: c.id, role: c.role }
}

export async function assertStaff(): Promise<AssertResult> {
  const c = await callerRole()
  if ('error' in c) return c
  if (!isStaff(c.role)) return { error: 'Team only' }
  return { adminId: c.id, role: c.role }
}
