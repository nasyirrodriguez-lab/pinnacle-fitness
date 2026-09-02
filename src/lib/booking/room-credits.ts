import type { SupabaseClient } from '@supabase/supabase-js'

// One-off room-hour credits, granted by admins from a member's page.
// The booking checkout consumes them (after plan benefits) when they
// cover the whole remaining booking.

interface CreditRow {
  id: string
  hours_granted: number
  hours_used: number
  expires_at: string | null
}

async function activeCreditRows(
  admin: SupabaseClient,
  userId: string,
  resourceId: string
): Promise<CreditRow[]> {
  const { data } = await admin
    .from('room_hour_credits')
    .select('id, hours_granted, hours_used, expires_at')
    .eq('user_id', userId)
    .eq('resource_id', resourceId)
  const now = Date.now()
  return ((data as CreditRow[] | null) ?? [])
    .filter(
      (r) =>
        Number(r.hours_granted) > Number(r.hours_used) &&
        (!r.expires_at || new Date(r.expires_at).getTime() > now)
    )
    .sort((a, b) => {
      // Soonest-expiring first; never-expiring last.
      const ax = a.expires_at ? new Date(a.expires_at).getTime() : Infinity
      const bx = b.expires_at ? new Date(b.expires_at).getTime() : Infinity
      return ax - bx
    })
}

export async function remainingRoomHours(
  admin: SupabaseClient,
  userId: string,
  resourceId: string
): Promise<number> {
  const rows = await activeCreditRows(admin, userId, resourceId)
  return rows.reduce(
    (sum, r) => sum + (Number(r.hours_granted) - Number(r.hours_used)),
    0
  )
}

export interface ConsumedCredit {
  id: string
  hours: number
}

// Consume `hours` across the member's credits, soonest-expiring first.
// Returns what was taken from each row so a failed booking can hand the
// hours back via refundRoomHours.
export async function consumeRoomHours(
  admin: SupabaseClient,
  userId: string,
  resourceId: string,
  hours: number
): Promise<{ ok: boolean; consumed: ConsumedCredit[] }> {
  const rows = await activeCreditRows(admin, userId, resourceId)
  const available = rows.reduce(
    (sum, r) => sum + (Number(r.hours_granted) - Number(r.hours_used)),
    0
  )
  if (available < hours) return { ok: false, consumed: [] }

  const consumed: ConsumedCredit[] = []
  let left = hours
  for (const row of rows) {
    if (left <= 0) break
    const free = Number(row.hours_granted) - Number(row.hours_used)
    const take = Math.min(free, left)
    const { error } = await admin
      .from('room_hour_credits')
      .update({ hours_used: Number(row.hours_used) + take })
      .eq('id', row.id)
    if (error) {
      console.error('[room-credits] consume failed:', error)
      await refundRoomHours(admin, consumed)
      return { ok: false, consumed: [] }
    }
    consumed.push({ id: row.id, hours: take })
    left -= take
  }
  return { ok: true, consumed }
}

export async function refundRoomHours(
  admin: SupabaseClient,
  consumed: ConsumedCredit[]
): Promise<void> {
  for (const c of consumed) {
    const { data } = await admin
      .from('room_hour_credits')
      .select('hours_used')
      .eq('id', c.id)
      .maybeSingle()
    if (!data) continue
    const current = Number((data as { hours_used: number }).hours_used)
    await admin
      .from('room_hour_credits')
      .update({ hours_used: Math.max(0, current - c.hours) })
      .eq('id', c.id)
  }
}
