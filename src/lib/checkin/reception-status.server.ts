import { createAdminClient } from '@/utils/supabase/admin'
import {
  RECEPTION_STATUS_ID,
  type ReceptionStatusRow,
} from '@/lib/checkin/reception-status'

// Server-only loader for the current reception status. Uses the admin
// client (service role) so it works regardless of session, and tolerates a
// missing row (e.g. before the migration seed runs) by returning null.
export async function loadReceptionStatus(): Promise<ReceptionStatusRow | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('reception_status')
      .select(
        'id, is_away, reason_id, message, away_since, return_at, set_by_device_id, updated_at'
      )
      .eq('id', RECEPTION_STATUS_ID)
      .maybeSingle()
    if (error) {
      console.error('[reception-status] load failed:', error)
      return null
    }
    return (data as ReceptionStatusRow | null) ?? null
  } catch (err) {
    console.error('[reception-status] load threw:', err)
    return null
  }
}
