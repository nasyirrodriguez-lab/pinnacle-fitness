import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { verifyCheckinToken } from '@/lib/checkin/qr'
import { createAdminClient } from '@/utils/supabase/admin'
import { memberAccess, accessShortfall } from '@/lib/gym/entitlement'
import { floorStatus, isOnFloor } from '@/lib/gym/floor'
import { loadGymSettings } from '@/lib/gym/settings'
import { checkinWindow } from '@/lib/gym/rules'
import { spendSession } from '@/lib/sessions/ledger'
import { parseTstzRange } from '@/lib/booking/slots'
import { astStartOfDay, astEndOfDay, fmtAstTime } from '@/lib/time/ast'

// =====================================================================
// The door. A member scans their QR (or is found by name + PIN) and
// this decides, in order:
//   1. already on the floor → say so
//   2. coach / staff / owner → in, never counted against the cap
//   3. a PT session booked for now → spend a PT session, check in
//   4. otherwise open gym → floor cap, then entitlement, then check in
// Every "no" carries what's wrong and what fixes it, so the iPad can
// show the fix instead of "see the manager".
// =====================================================================

const bodySchema = z
  .object({
    token: z.string().min(1).optional(),
    userId: z.string().uuid().optional(),
    pin: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
  })
  .refine((v) => Boolean(v.token || v.userId), {
    message: 'token or userId required',
  })

const PT_RESOURCES = ['pt-nasyir', 'pt-matthew']

export async function POST(request: NextRequest) {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  let body
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  let userId: string | null = null
  if (body.token) {
    const payload = verifyCheckinToken(body.token)
    if (!payload) {
      return NextResponse.json({ error: 'invalid_qr' }, { status: 400 })
    }
    userId = payload.uid
  } else if (body.userId) {
    userId = body.userId
  }
  if (!userId) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, role, designation, pin_code, archived')
    .eq('id', userId)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json({ error: 'unknown_member' }, { status: 404 })
  }
  const member = profile as {
    id: string
    full_name: string | null
    email: string
    role: string
    designation: string | null
    pin_code: string | null
    archived: boolean
  }
  if (member.archived) {
    return NextResponse.json({ error: 'unknown_member' }, { status: 404 })
  }

  // Name search (no QR) must be backed by the member's PIN.
  if (!body.token) {
    if (!member.pin_code) {
      return NextResponse.json({ error: 'pin_not_set' }, { status: 403 })
    }
    if (body.pin !== member.pin_code) {
      return NextResponse.json({ error: 'pin_mismatch' }, { status: 403 })
    }
  }

  const memberOut = {
    id: member.id,
    fullName: member.full_name,
    email: member.email,
  }

  const onFloor = await isOnFloor(admin, userId)
  if (onFloor) {
    return NextResponse.json({
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
        device_id: device.id,
        reason: 'team',
      })
      .select('id')
      .single()
    return NextResponse.json({
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
        return NextResponse.json({
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
        return NextResponse.json({
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
        device_id: device.id,
        reason: `pt · ${openNow.coachName}`,
      })
      .select('id')
      .single()
    return NextResponse.json({
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
    return NextResponse.json({
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
    return NextResponse.json({
      status: 'floor_full',
      member: memberOut,
      floor: { onFloor: floor.onFloor, cap: floor.cap },
    })
  }
  if (access.subscriptionStatus === 'lapsed') {
    return NextResponse.json({
      status: 'lapsed',
      member: memberOut,
      lapsedDays: access.lapsedDays,
      planName: access.plan?.name ?? null,
      ...accessShortfall(access, 'open_gym'),
    })
  }
  if (!access.canUseOpenGym) {
    return NextResponse.json({
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
      return NextResponse.json({
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
      device_id: device.id,
      reason: 'open gym',
    })
    .select('id')
    .single()
  if (visitErr || !visit) {
    return NextResponse.json({ error: 'visit_insert_failed' }, { status: 500 })
  }

  return NextResponse.json({
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
