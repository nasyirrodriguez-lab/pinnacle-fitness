import type { SupabaseClient } from '@supabase/supabase-js'
import { memberAccess, accessShortfall } from '@/lib/gym/entitlement'
import { floorStatus, isOnFloor } from '@/lib/gym/floor'
import { loadGymSettings } from '@/lib/gym/settings'
import { checkinWindow } from '@/lib/gym/rules'
import { spendSession } from '@/lib/sessions/ledger'
import { parseTstzRange } from '@/lib/booking/slots'
import { astStartOfDay, astEndOfDay, fmtAstTime } from '@/lib/time/ast'

// =====================================================================
// The door, as one function shared by the iPad and the member's own
// phone. Decides, in order:
//   1. already on the floor → say so
//   2. coach / staff / owner → in, never counted against the cap
//   3. a PT session booked for now → spend a PT session, check in
//   4. otherwise open gym → floor cap, then entitlement, then check in
// Every "no" carries what's wrong and what fixes it.
// =====================================================================

export interface GymMember {
  id: string
  full_name: string | null
  email: string
  role: string
  designation: string | null
}

export type GymCheckinResult = Record<string, unknown> & { status: string }

const PT_RESOURCES = ['pt-nasyir', 'pt-matthew']

function respond(payload: GymCheckinResult): GymCheckinResult {
  return payload
}

export async function gymCheckIn(
  admin: SupabaseClient,
  args: { member: GymMember; deviceId: string | null }
): Promise<GymCheckinResult> {
  const member = args.member
  const userId = member.id
  const memberOut = {
    id: member.id,
    fullName: member.full_name,
    email: member.email,
  }

  const onFloor = await isOnFloor(admin, userId)
  if (onFloor) {
    return respond({
      status: 'already_checked_in',
      member: memberOut,
      visitId: onFloor.visitId,
      since: onFloor.checkedInAt,
    })
  }

  // Coaches, staff and owners come and go freely and don't take a spot.
  const isTeam =
    ['coach', 'owner', 'staff', 'admin'].includes(member.role) ||
    Boolean(member.designation)
  if (isTeam) {
    const { data: visit } = await admin
      .from('visits')
      .insert({
        user_id: userId,
        kind: 'member',
        device_id: args.deviceId,
        reason: 'team',
      })
      .select('id')
      .single()
    return respond({
      status: 'checked_in',
      via: 'team',
      member: memberOut,
      visitId: (visit as { id: string } | null)?.id ?? null,
    })
  }

  const [settings, access, floor] = await Promise.all([
    loadGymSettings(admin),
    memberAccess(admin, userId),
    floorStatus(admin),
  ])

  // ---- PT session booked today? ----
  const now = new Date()
  const { data: bookingRows } = await admin
    .from('bookings')
    .select('id, during, resource_id, checked_in_at, resources(name)')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .in('resource_id', PT_RESOURCES)
    .is('checked_in_at', null)
    .gte('during', `[${astStartOfDay(now).toISOString()},)`)
    .lt('during', `[${astEndOfDay(now).toISOString()},)`)
    .order('during', { ascending: true })
    .limit(3)

  type BookingRow = {
    id: string
    during: string
    resource_id: string
    resources: { name?: string } | { name?: string }[] | null
  }
  const bookings = ((bookingRows as BookingRow[] | null) ?? [])
    .map((b) => {
      const range = parseTstzRange(b.during)
      const resRaw = b.resources
      const res = Array.isArray(resRaw) ? (resRaw[0] ?? null) : resRaw
      return range
        ? {
            id: b.id,
            startIso: range.during_lower,
            endIso: range.during_upper,
            resourceId: b.resource_id,
            coachName: res?.name ?? 'your coach',
          }
        : null
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)

  const openNow = bookings.find(
    (b) => checkinWindow(b.startIso, settings) === 'open'
  )
  const nearest = bookings[0] ?? null

  if (openNow) {
    if (!access.ptUnlimited) {
      if (access.subscriptionStatus === 'lapsed') {
        return respond({
          status: 'lapsed',
          member: memberOut,
          lapsedDays: access.lapsedDays,
          planName: access.plan?.name ?? null,
          ...accessShortfall(access, 'pt'),
        })
      }
      const spend = await spendSession(admin, {
        userId,
        kind: 'pt',
        reason: 'checkin_use',
        bookingId: openNow.id,
      })
      if (!spend.ok) {
        return respond({
          status: 'needs_payment',
          kind: 'pt',
          member: memberOut,
          ...accessShortfall(access, 'pt'),
          booking: {
            coachName: openNow.coachName,
            startLabel: fmtAstTime(openNow.startIso),
          },
        })
      }
    }
    await admin
      .from('bookings')
      .update({ checked_in_at: now.toISOString(), checkin_count: 1 })
      .eq('id', openNow.id)
    const { data: visit } = await admin
      .from('visits')
      .insert({
        user_id: userId,
        kind: 'pt',
        device_id: args.deviceId,
        reason: `pt · ${openNow.coachName}`,
      })
      .select('id')
      .single()
    return respond({
      status: 'checked_in',
      via: 'pt',
      member: memberOut,
      visitId: (visit as { id: string } | null)?.id ?? null,
      booking: {
        coachName: openNow.coachName,
        startLabel: fmtAstTime(openNow.startIso),
      },
      ptLeft: access.ptUnlimited ? null : Math.max(0, access.ptBalance - 1),
      floor: { onFloor: floor.onFloor + 1, cap: floor.cap },
    })
  }

  if (
    nearest &&
    checkinWindow(nearest.startIso, settings) === 'early' &&
    !access.canUseOpenGym
  ) {
    return respond({
      status: 'pt_early',
      member: memberOut,
      booking: {
        coachName: nearest.coachName,
        startLabel: fmtAstTime(nearest.startIso),
      },
      earlyMinutes: settings.checkinEarlyMinutes,
    })
  }

  // ---- Open gym ----
  if (floor.isFull) {
    return respond({
      status: 'floor_full',
      member: memberOut,
      floor: { onFloor: floor.onFloor, cap: floor.cap },
    })
  }
  if (access.subscriptionStatus === 'lapsed') {
    return respond({
      status: 'lapsed',
      member: memberOut,
      lapsedDays: access.lapsedDays,
      planName: access.plan?.name ?? null,
      ...accessShortfall(access, 'open_gym'),
    })
  }
  if (!access.canUseOpenGym) {
    return respond({
      status: 'needs_payment',
      kind: 'open_gym',
      member: memberOut,
      ...accessShortfall(access, 'open_gym'),
      lateBooking:
        nearest && checkinWindow(nearest.startIso, settings) === 'late'
          ? {
              coachName: nearest.coachName,
              startLabel: fmtAstTime(nearest.startIso),
            }
          : null,
    })
  }

  if (!access.openGymUnlimited) {
    const spend = await spendSession(admin, {
      userId,
      kind: 'open_gym',
      reason: 'checkin_use',
    })
    if (!spend.ok) {
      return respond({
        status: 'needs_payment',
        kind: 'open_gym',
        member: memberOut,
        ...accessShortfall(access, 'open_gym'),
      })
    }
  }
  const { data: visit, error: visitErr } = await admin
    .from('visits')
    .insert({
      user_id: userId,
      kind: 'open_gym',
      device_id: args.deviceId,
      reason: 'open gym',
    })
    .select('id')
    .single()
  if (visitErr || !visit) {
    return respond({ status: 'error', error: 'visit_insert_failed' })
  }

  return respond({
    status: 'checked_in',
    via: 'open_gym',
    member: memberOut,
    visitId: (visit as { id: string }).id,
    openGymLeft: access.openGymUnlimited
      ? null
      : Math.max(0, access.openGymBalance - 1),
    grace:
      access.subscriptionStatus === 'grace'
        ? {
            lapsedDays: access.lapsedDays,
            planName: access.plan?.name ?? null,
          }
        : null,
    floor: { onFloor: floor.onFloor + 1, cap: floor.cap },
  })
}
