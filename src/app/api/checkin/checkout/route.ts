import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { createAdminClient } from '@/utils/supabase/admin'

// =====================================================================
// Kiosk check-out.
//   GET  → list currently-open visits (for the tap-your-name screen)
//   POST → close one visit (sets checked_out_at)
// Both gated by the paired-device cookie, same trust model as check-in.
// Open visits older than 16h are excluded from the list — those are
// forgotten check-ins from a previous day, not people in the building.
// =====================================================================

const OPEN_VISIT_WINDOW_MS = 16 * 60 * 60 * 1000

export async function GET() {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - OPEN_VISIT_WINDOW_MS).toISOString()
  const { data, error } = await admin
    .from('visits')
    .select(
      'id, kind, guest_name, checked_in_at, user_id, profiles!visits_user_id_fkey(full_name, email)'
    )
    .is('checked_out_at', null)
    .gte('checked_in_at', cutoff)
    .order('checked_in_at', { ascending: false })
    .limit(60)

  if (error) {
    console.error('[checkin/checkout] list failed:', error)
    return NextResponse.json({ error: 'list_failed' }, { status: 500 })
  }

  type Row = {
    id: string
    kind: string
    guest_name: string | null
    checked_in_at: string
    user_id: string | null
    profiles:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null
  }
  const visits = ((data as Row[] | null) ?? []).map((r) => {
    const profile = Array.isArray(r.profiles)
      ? (r.profiles[0] ?? null)
      : r.profiles
    return {
      id: r.id,
      kind: r.kind,
      displayName:
        profile?.full_name ?? r.guest_name ?? profile?.email ?? 'Visitor',
      checkedInAt: r.checked_in_at,
    }
  })

  return NextResponse.json({ visits })
}

const checkoutSchema = z.object({ visitId: z.string().uuid() })

export async function POST(request: NextRequest) {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  let body
  try {
    body = checkoutSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('visits')
    .update({ checked_out_at: new Date().toISOString() })
    .eq('id', body.visitId)
    .is('checked_out_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[checkin/checkout] update failed:', error)
    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'already_checked_out' }, { status: 409 })
  }

  return NextResponse.json({ status: 'checked_out' })
}
