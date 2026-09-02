'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/utils/supabase/admin'
import { assertTeam } from '@/lib/auth/assert'
import { createPtBooking, CREATE_BOOKING_MESSAGES } from '@/lib/booking/create'
import { checkInBookingArrival } from '@/lib/booking/arrival'
import { loadGymSettings } from '@/lib/gym/settings'
import { cancelOutcome } from '@/lib/gym/rules'
import { spendSession } from '@/lib/sessions/ledger'
import { parseTstzRange } from '@/lib/booking/slots'

export type AdminActionResult = { ok: true } | { ok: false; error: string }

// ---- book a member in (coach's call) ----

const createSchema = z.object({
  userId: z.string().uuid(),
  resourceId: z.string().min(1),
  startIso: z.string().min(1),
  // A coach can book someone with no PT balance — the session goes on
  // their tab and the check-in screen will ask them to top up.
  overrideNoSessions: z.boolean().optional(),
  note: z.string().trim().max(500).optional().nullable(),
})

export type AdminCreateBookingResult =
  | { ok: true; label: string }
  | { ok: false; error: string; code?: string }

export async function adminCreateBooking(
  input: z.infer<typeof createSchema>
): Promise<AdminCreateBookingResult> {
  const auth = await assertTeam()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = createSchema.parse(input)
  } catch {
    return { ok: false, error: 'Pick a member, a coach and an hour' }
  }
  const admin = createAdminClient()
  const result = await createPtBooking(admin, {
    userId: data.userId,
    resourceId: data.resourceId,
    startIso: data.startIso,
  })
  if (!result.ok) {
    if (result.error === 'no_sessions' && data.overrideNoSessions) {
      // Force it: insert directly, same shape the lib produces.
      const forced = await forceBooking(admin, data)
      if (!forced.ok) return forced
      await note(admin, data.userId, auth.adminId, `Booked ${forced.label} without PT balance (coach's call).${data.note ? ` ${data.note}` : ''}`)
      revalidatePath('/admin/bookings')
      revalidatePath('/coach')
      return forced
    }
    return {
      ok: false,
      error: CREATE_BOOKING_MESSAGES[result.error],
      code: result.error,
    }
  }
  if (data.note?.trim()) {
    await note(admin, data.userId, auth.adminId, `Booked ${result.booking.coachName} ${result.booking.dayLabel} ${result.booking.timeLabel}: ${data.note.trim()}`)
  }
  revalidatePath('/admin/bookings')
  revalidatePath('/coach')
  revalidatePath('/dashboard/bookings')
  return {
    ok: true,
    label: `${result.booking.coachName} · ${result.booking.dayLabel} ${result.booking.timeLabel}`,
  }
}

async function forceBooking(
  admin: ReturnType<typeof createAdminClient>,
  data: { userId: string; resourceId: string; startIso: string }
): Promise<AdminCreateBookingResult> {
  const start = new Date(data.startIso)
  if (Number.isNaN(start.getTime())) return { ok: false, error: 'Bad time' }
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const { data: group } = await admin
    .from('booking_groups')
    .insert({ user_id: data.userId, total_cents: 0, currency: 'TTD', status: 'confirmed', expires_at: end.toISOString() })
    .select('id')
    .single()
  const { error } = await admin.from('bookings').insert({
    user_id: data.userId,
    resource_id: data.resourceId,
    during: `[${start.toISOString()},${end.toISOString()})`,
    status: 'confirmed',
    price_cents: 0,
    covered_by_plan: true,
    booking_group_id: (group as { id: string } | null)?.id ?? null,
  })
  if (error) {
    const full = (error as { code?: string }).code === '23514'
    return { ok: false, error: full ? 'That hour just filled up.' : 'Could not save the booking' }
  }
  return { ok: true, label: `${data.resourceId.replace('pt-', '')} · ${start.toISOString()}` }
}

async function note(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  authorId: string,
  body: string
) {
  await admin.from('admin_notes').insert({ user_id: userId, author_id: authorId, body })
}

// ---- cancel (team override: always allowed, but the rules decide the session) ----

const cancelSchema = z.object({
  bookingId: z.string().uuid(),
  waiveSession: z.boolean().optional(),
})

export async function adminCancelBooking(
  input: z.infer<typeof cancelSchema>
): Promise<AdminActionResult> {
  const auth = await assertTeam()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = cancelSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid request' }
  }
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('bookings')
    .select('id, user_id, during, status')
    .eq('id', data.bookingId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Booking not found' }
  const b = row as { id: string; user_id: string | null; during: string; status: string }
  if (b.status !== 'confirmed') return { ok: false, error: `Already ${b.status}` }

  const { error } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', b.id)
    .eq('status', 'confirmed')
  if (error) return { ok: false, error: 'Could not cancel' }

  const range = parseTstzRange(b.during)
  if (b.user_id && range && !data.waiveSession) {
    const settings = await loadGymSettings(admin)
    if (cancelOutcome(range.during_lower, settings) === 'uses_session') {
      await spendSession(admin, { userId: b.user_id, kind: 'pt', reason: 'late_cancel', bookingId: b.id, createdBy: auth.adminId })
    }
  }
  revalidatePath('/admin/bookings')
  revalidatePath('/coach')
  revalidatePath('/dashboard/bookings')
  return { ok: true }
}

// ---- check in from the admin (when the iPad is down) ----

export async function adminCheckInBooking(input: {
  bookingId: string
}): Promise<AdminActionResult> {
  const auth = await assertTeam()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!z.string().uuid().safeParse(input.bookingId).success) {
    return { ok: false, error: 'Invalid booking' }
  }
  const admin = createAdminClient()
  const r = await checkInBookingArrival(admin, input.bookingId)
  if (!r.ok) {
    return {
      ok: false,
      error:
        r.error === 'already_checked_in' ? 'Already checked in' : 'Could not check in',
    }
  }
  const { data: row } = await admin
    .from('bookings')
    .select('user_id')
    .eq('id', input.bookingId)
    .maybeSingle()
  const userId = (row as { user_id: string | null } | null)?.user_id
  if (userId) {
    const { data: spent } = await admin
      .from('session_ledger')
      .select('id')
      .eq('booking_id', input.bookingId)
      .lt('delta', 0)
      .limit(1)
    if (!spent || spent.length === 0) {
      await spendSession(admin, { userId, kind: 'pt', reason: 'checkin_use', bookingId: input.bookingId, createdBy: auth.adminId })
    }
  }
  revalidatePath('/admin/bookings')
  revalidatePath('/coach')
  return { ok: true }
}
