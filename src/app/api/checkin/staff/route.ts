import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { createAdminClient } from '@/utils/supabase/admin'

// =====================================================================
// Kiosk "Staff, partners & private" check-in.
//   GET  → everyone holding a designation, with today's arrival state
//   POST → check one in (free — no pass, no subscription needed)
// Gated by the paired-device cookie, same trust model as the rest.
// =====================================================================

const OPEN_VISIT_WINDOW_MS = 16 * 60 * 60 * 1000

export async function GET() {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - OPEN_VISIT_WINDOW_MS).toISOString()
  const [{ data: people, error }, { data: openVisits }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, email, designation, designation_roles(label)')
      .not('designation', 'is', null)
      .eq('archived', false)
      .order('full_name', { ascending: true }),
    admin
      .from('visits')
      .select('user_id')
      .is('checked_out_at', null)
      .gte('checked_in_at', cutoff),
  ])
  if (error) {
    console.error('[checkin/staff] list failed:', error)
    return NextResponse.json({ error: 'list_failed' }, { status: 500 })
  }

  const here = new Set(
    ((openVisits as { user_id: string | null }[] | null) ?? [])
      .map((v) => v.user_id)
      .filter(Boolean)
  )

  type Row = {
    id: string
    full_name: string | null
    email: string
    designation: string
    designation_roles: { label?: string } | { label?: string }[] | null
  }
  const mapped = ((people as Row[] | null) ?? []).map((r) => {
    const roleRaw = r.designation_roles
    const role = Array.isArray(roleRaw) ? (roleRaw[0] ?? null) : roleRaw
    return {
      id: r.id,
      displayName: r.full_name?.trim() || r.email,
      roleLabel: role?.label ?? r.designation.replace(/_/g, ' '),
      checkedIn: here.has(r.id),
    }
  })

  // Some people hold two accounts under the same name — show one card.
  // Prefer the account that's already checked in so the state reads
  // truthfully; either account works for a fresh check-in.
  const byName = new Map<string, (typeof mapped)[number]>()
  for (const person of mapped) {
    const key = person.displayName.toLowerCase()
    const existing = byName.get(key)
    if (!existing || (person.checkedIn && !existing.checkedIn)) {
      byName.set(key, person)
    }
  }
  const staff = [...byName.values()]

  return NextResponse.json({ staff })
}

const checkinSchema = z.object({ userId: z.string().uuid() })

export async function POST(request: NextRequest) {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  let body
  try {
    body = checkinSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profileRow } = await admin
    .from('profiles')
    .select('id, full_name, email, designation, designation_roles(label)')
    .eq('id', body.userId)
    .not('designation', 'is', null)
    .eq('archived', false)
    .maybeSingle()
  if (!profileRow) {
    return NextResponse.json({ error: 'not_designated' }, { status: 403 })
  }
  const profile = profileRow as {
    id: string
    full_name: string | null
    email: string
    designation: string
    designation_roles: { label?: string } | { label?: string }[] | null
  }

  // Already in the building? Don't double-log.
  const cutoff = new Date(Date.now() - OPEN_VISIT_WINDOW_MS).toISOString()
  const { data: open } = await admin
    .from('visits')
    .select('id')
    .eq('user_id', profile.id)
    .is('checked_out_at', null)
    .gte('checked_in_at', cutoff)
    .limit(1)
  if (open && open.length > 0) {
    return NextResponse.json({ error: 'already_checked_in' }, { status: 409 })
  }

  const roleRaw = profile.designation_roles
  const role = Array.isArray(roleRaw) ? (roleRaw[0] ?? null) : roleRaw
  const roleLabel = role?.label ?? profile.designation.replace(/_/g, ' ')

  const { error: visitErr } = await admin.from('visits').insert({
    user_id: profile.id,
    kind: 'member',
    reason: roleLabel,
  })
  if (visitErr) {
    console.error('[checkin/staff] visit insert failed:', visitErr)
    return NextResponse.json({ error: 'checkin_failed' }, { status: 500 })
  }

  return NextResponse.json({
    status: 'checked_in',
    displayName: profile.full_name?.trim() || profile.email,
    roleLabel,
  })
}
