import type { SupabaseClient } from '@supabase/supabase-js'

// Owner-tunable numbers live in the settings table so "the floor holds
// 20" is a field, not a deploy. Defaults here are the launch values.

export interface GymSettings {
  floorCap: number
  autoSignoutHours: number
  ptCancelHours: number
  noShowMinutes: number
  checkinEarlyMinutes: number
  checkinLateMinutes: number
  lapseGraceDays: number
  rentTargetCents: number
}

export const DEFAULT_SETTINGS: GymSettings = {
  floorCap: 20,
  autoSignoutHours: 3,
  ptCancelHours: 4,
  noShowMinutes: 60,
  checkinEarlyMinutes: 30,
  checkinLateMinutes: 30,
  lapseGraceDays: 3,
  rentTargetCents: 0,
}

const KEYS: Record<keyof GymSettings, string> = {
  floorCap: 'floor_cap',
  autoSignoutHours: 'auto_signout_hours',
  ptCancelHours: 'pt_cancel_hours',
  noShowMinutes: 'no_show_minutes',
  checkinEarlyMinutes: 'checkin_early_minutes',
  checkinLateMinutes: 'checkin_late_minutes',
  lapseGraceDays: 'lapse_grace_days',
  rentTargetCents: 'rent_target_cents',
}

export async function loadGymSettings(
  admin: SupabaseClient
): Promise<GymSettings> {
  const { data } = await admin.from('settings').select('key, value')
  const map = new Map<string, unknown>(
    ((data as { key: string; value: unknown }[] | null) ?? []).map((r) => [
      r.key,
      r.value,
    ])
  )
  const out: GymSettings = { ...DEFAULT_SETTINGS }
  for (const [field, key] of Object.entries(KEYS) as [
    keyof GymSettings,
    string,
  ][]) {
    const raw = map.get(key)
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(n)) out[field] = n
  }
  return out
}

export async function saveGymSetting(
  admin: SupabaseClient,
  field: keyof GymSettings,
  value: number
): Promise<boolean> {
  const { error } = await admin
    .from('settings')
    .upsert({ key: KEYS[field], value }, { onConflict: 'key' })
  return !error
}
