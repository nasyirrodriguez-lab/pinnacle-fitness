import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { createAdminClient } from '@/utils/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import { astStartOfDay } from '@/lib/time/ast'

// =====================================================================
// Kiosk group membership check-in.
//   GET  → members holding an active *group* plan or pass, with how
//          many of their group have checked in today
//   POST → check one person in under a member's group product: they
//          type their name, the visit links to the host, and the entry
//          disappears once today's headcount hits the group size.
// Group passes burn one pass day on the first arrival of the day; the
// rest of the group rides that same day.
// =====================================================================

interface GroupHolder {
  ownerId: string
  ownerName: string
  productName: string
  groupSize: number
  todayCount: number
  source: 'plan' | 'pass'
  passPurchaseId: string | null
}

async function loadGroupHolders(admin: SupabaseClient): Promise<GroupHolder[]> {
  const nowIso = new Date().toISOString()
  const [{ data: subs }, { data: passes }] = await Promise.all([
    admin
      .from('subscriptions')
      .select(
        'user_id, current_period_end, plans!inner(name, group_size), profiles(full_name, email)'
      )
      .in('status', ['active', 'past_due'])
      .not('plans.group_size', 'is', null),
    admin
      .from('pass_purchases')
      .select(
        'id, user_id, uses_remaining, expires_at, passes!inner(name, group_size), profiles(full_name, email)'
      )
      .gt('uses_remaining', 0)
      .gt('expires_at', nowIso)
      .not('passes.group_size', 'is', null),
  ])

  const holders = new Map<string, GroupHolder>()

  type SubRow = {
    user_id: string
    current_period_end: string
    plans: { name?: string; group_size?: number | null } | null
    profiles:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null
  }
  for (const raw of (subs as unknown as SubRow[] | null) ?? []) {
    if (new Date(raw.current_period_end).getTime() < Date.now()) continue
    const plan = Array.isArray(raw.plans) ? raw.plans[0] : raw.plans
    if (!plan?.group_size) continue
    const profRaw = raw.profiles
    const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
    holders.set(raw.user_id, {
      ownerId: raw.user_id,
      ownerName: profile?.full_name?.trim() || profile?.email || 'Member',
      productName: plan.name ?? 'Group plan',
      groupSize: plan.group_size,
      todayCount: 0,
      source: 'plan',
      passPurchaseId: null,
    })
  }

  type PassRow = {
    id: string
    user_id: string
    passes: { name?: string; group_size?: number | null } | null
    profiles:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null
  }
  for (const raw of (passes as unknown as PassRow[] | null) ?? []) {
    if (holders.has(raw.user_id)) continue
    const pass = Array.isArray(raw.passes) ? raw.passes[0] : raw.passes
    if (!pass?.group_size) continue
    const profRaw = raw.profiles
    const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
    holders.set(raw.user_id, {
      ownerId: raw.user_id,
      ownerName: profile?.full_name?.trim() || profile?.email || 'Member',
      productName: pass.name ?? 'Group pass',
      groupSize: pass.group_size,
      todayCount: 0,
      source: 'pass',
      passPurchaseId: raw.id,
    })
  }

  if (holders.size === 0) return []

  // Today's group arrivals per host.
  const dayStart = astStartOfDay(new Date()).toISOString()
  const { data: todays } = await admin
    .from('visits')
    .select('host_user_id')
    .in('host_user_id', [...holders.keys()])
    .gte('checked_in_at', dayStart)
  for (const v of (todays as { host_user_id: string | null }[] | null) ?? []) {
    if (!v.host_user_id) continue
    const h = holders.get(v.host_user_id)
    if (h) h.todayCount += 1
  }

  return [...holders.values()].sort((a, b) =>
    a.ownerName.localeCompare(b.ownerName)
  )
}

export async function GET() {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }
  const admin = createAdminClient()
  const holders = await loadGroupHolders(admin)
  return NextResponse.json({
    groups: holders
      .filter((h) => h.todayCount < h.groupSize)
      .map((h) => ({
        ownerId: h.ownerId,
        ownerName: h.ownerName,
        productName: h.productName,
        groupSize: h.groupSize,
        todayCount: h.todayCount,
      })),
  })
}

const checkinSchema = z.object({
  ownerId: z.string().uuid(),
  guestName: z.string().trim().min(1, 'Type your name').max(120),
})

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
  const holders = await loadGroupHolders(admin)
  const holder = holders.find((h) => h.ownerId === body.ownerId)
  if (!holder) {
    return NextResponse.json({ error: 'no_group_product' }, { status: 404 })
  }
  if (holder.todayCount >= holder.groupSize) {
    return NextResponse.json({ error: 'group_full' }, { status: 409 })
  }

  // Group passes: the first arrival of the day burns one pass day.
  if (holder.source === 'pass' && holder.todayCount === 0) {
    const { data: passRow } = await admin
      .from('pass_purchases')
      .select('uses_remaining')
      .eq('id', holder.passPurchaseId!)
      .maybeSingle()
    const remaining =
      (passRow as { uses_remaining?: number } | null)?.uses_remaining ?? 0
    if (remaining <= 0) {
      return NextResponse.json({ error: 'no_group_product' }, { status: 409 })
    }
    await admin
      .from('pass_purchases')
      .update({ uses_remaining: remaining - 1 })
      .eq('id', holder.passPurchaseId!)
      .gt('uses_remaining', 0)
  }

  const { error: visitErr } = await admin.from('visits').insert({
    kind: 'guest',
    guest_name: body.guestName,
    host_user_id: holder.ownerId,
    reason: `group · ${holder.productName}`,
  })
  if (visitErr) {
    console.error('[checkin/group] visit insert failed:', visitErr)
    return NextResponse.json({ error: 'checkin_failed' }, { status: 500 })
  }

  return NextResponse.json({
    status: 'checked_in',
    ownerName: holder.ownerName,
    checkedIn: holder.todayCount + 1,
    groupSize: holder.groupSize,
  })
}
