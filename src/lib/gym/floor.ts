import type { SupabaseClient } from '@supabase/supabase-js'
import { loadGymSettings } from '@/lib/gym/settings'

// Open gym is a live headcount, not a timetable. Anyone with an open
// visit of kind pt / open_gym is "on the floor"; the iPad admits a new
// member only while that count is under the cap, and stale visits are
// auto-signed-out so a forgotten scan-out can't hold a spot all day.

export const FLOOR_KINDS = ['pt', 'open_gym'] as const

export interface FloorStatus {
  onFloor: number
  cap: number
  spaceLeft: number
  isFull: boolean
}

export async function floorStatus(admin: SupabaseClient): Promise<FloorStatus> {
  const [settings, { count }] = await Promise.all([
    loadGymSettings(admin),
    admin
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .in('kind', [...FLOOR_KINDS])
      .is('checked_out_at', null),
  ])
  const onFloor = count ?? 0
  return {
    onFloor,
    cap: settings.floorCap,
    spaceLeft: Math.max(0, settings.floorCap - onFloor),
    isFull: onFloor >= settings.floorCap,
  }
}

export async function isOnFloor(
  admin: SupabaseClient,
  userId: string
): Promise<{ visitId: string; checkedInAt: string } | null> {
  const { data } = await admin
    .from('visits')
    .select('id, checked_in_at')
    .eq('user_id', userId)
    .in('kind', [...FLOOR_KINDS])
    .is('checked_out_at', null)
    .order('checked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const row = data as { id: string; checked_in_at: string }
  return { visitId: row.id, checkedInAt: row.checked_in_at }
}

// Cron: sign out anyone who's been "in" longer than the auto-signout
// window. Returns how many were cleared.
export async function autoSignOutStale(admin: SupabaseClient): Promise<number> {
  const settings = await loadGymSettings(admin)
  const cutoff = new Date(
    Date.now() - settings.autoSignoutHours * 60 * 60 * 1000
  ).toISOString()
  const { data } = await admin
    .from('visits')
    .update({
      checked_out_at: new Date().toISOString(),
      notes: 'auto signed out',
    })
    .in('kind', [...FLOOR_KINDS])
    .is('checked_out_at', null)
    .lt('checked_in_at', cutoff)
    .select('id')
  return ((data as { id: string }[] | null) ?? []).length
}
