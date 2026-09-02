import type { SupabaseClient } from '@supabase/supabase-js'
import { parseTstzRange } from '@/lib/booking/slots'

export interface NextBooking {
  id: string
  coachName: string
  resourceId: string
  startIso: string
  endIso: string
  checkedIn: boolean
}

// The member's next confirmed PT session (or the one in progress).
export async function nextPtBooking(
  admin: SupabaseClient,
  userId: string
): Promise<NextBooking | null> {
  const since = new Date(Date.now() - 90 * 60 * 1000).toISOString()
  const { data } = await admin
    .from('bookings')
    .select('id, during, resource_id, checked_in_at, resources(name)')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .in('resource_id', ['pt-nasyir', 'pt-matthew'])
    .gte('during', `[${since},)`)
    .order('during', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const row = data as {
    id: string
    during: string
    resource_id: string
    checked_in_at: string | null
    resources: { name?: string } | { name?: string }[] | null
  }
  const range = parseTstzRange(row.during)
  if (!range) return null
  const resRaw = row.resources
  const res = Array.isArray(resRaw) ? (resRaw[0] ?? null) : resRaw
  return {
    id: row.id,
    coachName: (res?.name ?? 'your coach').replace(/^PT · /, ''),
    resourceId: row.resource_id,
    startIso: range.during_lower,
    endIso: range.during_upper,
    checkedIn: Boolean(row.checked_in_at),
  }
}
