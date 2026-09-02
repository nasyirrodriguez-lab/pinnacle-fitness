import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { autoSignOutStale } from '@/lib/gym/floor'
import { expirePacks, spendSession } from '@/lib/sessions/ledger'
import { loadGymSettings } from '@/lib/gym/settings'
import { isNoShow } from '@/lib/gym/rules'
import { parseTstzRange } from '@/lib/booking/slots'
import { expireLapsedInvites } from '@/lib/applications/approve'

// =====================================================================
// Cron, every 15 minutes: keep the gym's live state honest.
//   - sign out anyone still "on the floor" past the auto-signout window
//   - write off expired packs
//   - mark PT no-shows (booking un-checked-in past the window) and spend
//     the session, so credit never silently survives a missed slot
// =====================================================================

export const maxDuration = 120

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const settings = await loadGymSettings(admin)
  const signedOut = await autoSignOutStale(admin)
  const { expired } = await expirePacks(admin)
  const invitesExpired = await expireLapsedInvites(admin)

  // No-shows: confirmed PT bookings that started more than the no-show
  // window ago, never checked in, not already marked.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: rows } = await admin
    .from('bookings')
    .select('id, user_id, during, checked_in_at, status, resource_id')
    .eq('status', 'confirmed')
    .in('resource_id', ['pt-nasyir', 'pt-matthew'])
    .is('checked_in_at', null)
    .gte('during', `[${since},)`)
    .limit(200)
  let noShows = 0
  for (const b of (rows as
    | {
        id: string
        user_id: string | null
        during: string
        checked_in_at: string | null
      }[]
    | null) ?? []) {
    const range = parseTstzRange(b.during)
    if (!range || !b.user_id) continue
    if (!isNoShow(range.during_lower, b.checked_in_at, settings)) continue
    const { error } = await admin
      .from('bookings')
      .update({ status: 'no_show' })
      .eq('id', b.id)
      .eq('status', 'confirmed')
    if (error) continue
    await spendSession(admin, {
      userId: b.user_id,
      kind: 'pt',
      reason: 'no_show',
      bookingId: b.id,
    })
    noShows++
  }

  return NextResponse.json({
    ok: true,
    signedOut,
    expired,
    noShows,
    invitesExpired,
  })
}
