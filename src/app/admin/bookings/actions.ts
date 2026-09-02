'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isOwner } from '@/lib/auth/roles'
import {
  priceSlotsCents,
  rateForSlotCents,
  parseTstzRange,
} from '@/lib/booking/slots'
import { checkInBookingArrival } from '@/lib/booking/arrival'
import { computePlanCoverage } from '@/lib/booking/plan-benefits'
import {
  consumeRoomHours,
  refundRoomHours,
  remainingRoomHours,
  type ConsumedCredit,
} from '@/lib/booking/room-credits'
import { sendBookingPaymentReminder } from '@/lib/email/payment-reminder'
import { sendMemberNotification } from '@/lib/notifications/notify'

async function assertAdmin(): Promise<{ adminId: string } | { error: string }> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || !isOwner((profile as { role?: string }).role)) {
    return { error: 'Owners only' }
  }
  return { adminId: user.id }
}

export type AdminActionResult = { ok: true } | { ok: false; error: string }

const cancelSchema = z.object({
  bookingId: z.string().uuid(),
})

// Admin override: cancels regardless of the 60-min cutoff that gates member
// self-cancel. Logs the admin id on an internal note.
export async function adminCancelBooking(
  input: z.infer<typeof cancelSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = cancelSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid request' }
  }

  const admin = createAdminClient()

  const { data: booking, error: loadErr } = await admin
    .from('bookings')
    .select('id, user_id, status')
    .eq('id', data.bookingId)
    .maybeSingle()

  if (loadErr || !booking) {
    return { ok: false, error: 'Booking not found' }
  }

  const row = booking as Record<string, unknown>
  const status = row.status as string
  if (status === 'cancelled') {
    return { ok: false, error: 'Already cancelled' }
  }
  if (status !== 'confirmed' && status !== 'held') {
    return {
      ok: false,
      error: `Cannot cancel a ${status} booking`,
    }
  }

  const { error: updateErr } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', data.bookingId)
  if (updateErr) {
    console.error('[admin/cancelBooking] update failed:', updateErr)
    return { ok: false, error: 'Could not cancel' }
  }

  // Audit trail: stamp an admin note on the affected member.
  const userId = row.user_id as string | null
  if (userId) {
    await admin.from('admin_notes').insert({
      user_id: userId,
      author_id: auth.adminId,
      body: `Admin cancelled booking ${data.bookingId}.`,
    })
  }

  revalidatePath('/admin/bookings')
  if (userId) revalidatePath(`/admin/members/${userId}`)
  revalidatePath('/dashboard/bookings')
  return { ok: true }
}

// =====================================================================
// Admin: edit an existing booking. Any subset of fields can change.
// Resource and time changes both re-run the exclusion-constraint check
// at insert/update time; a 23P01 violation means another booking
// already occupies the new slot.
// =====================================================================

const updateBookingSchema = z.object({
  bookingId: z.string().uuid(),
  resourceId: z.string().min(1).optional(),
  startIso: z.string().min(1).optional(),
  endIso: z.string().min(1).optional(),
  priceCents: z.number().int().min(0).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function adminUpdateBooking(
  input: z.infer<typeof updateBookingSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = updateBookingSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()

  // Build the update payload. Both start and end must be supplied
  // together when changing time.
  const update: Record<string, unknown> = {}
  if (data.resourceId !== undefined) update.resource_id = data.resourceId
  if (data.priceCents !== undefined) update.price_cents = data.priceCents
  if (data.notes !== undefined) update.notes = data.notes

  if (data.startIso !== undefined || data.endIso !== undefined) {
    if (!data.startIso || !data.endIso) {
      return {
        ok: false,
        error: 'Provide both start and end when rescheduling',
      }
    }
    const start = new Date(data.startIso).getTime()
    const end = new Date(data.endIso).getTime()
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return { ok: false, error: 'Invalid start/end' }
    }
    update.during = `[${data.startIso},${data.endIso})`
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, error: 'Nothing to change' }
  }

  // Lookup current booking so we can audit-trail the change.
  const { data: prev } = await admin
    .from('bookings')
    .select('id, user_id, resource_id, during, status, price_cents, notes')
    .eq('id', data.bookingId)
    .maybeSingle()
  if (!prev) return { ok: false, error: 'Booking not found' }
  const prevRow = prev as {
    id: string
    user_id: string | null
    resource_id: string
    during: string
    status: string
    price_cents: number
    notes: string | null
  }

  if (prevRow.status === 'cancelled') {
    return { ok: false, error: 'Cannot edit a cancelled booking' }
  }

  const { error: updErr } = await admin
    .from('bookings')
    .update(update)
    .eq('id', data.bookingId)
  if (updErr) {
    const isConflict = (updErr as { code?: string }).code === '23P01'
    if (isConflict) {
      return {
        ok: false,
        error:
          'That room/time is already booked. Pick a different room or time.',
      }
    }
    console.error('[admin/updateBooking] update failed:', updErr)
    return { ok: false, error: 'Could not save changes' }
  }

  // Light audit trail for member bookings.
  if (prevRow.user_id) {
    const summary: string[] = []
    if (update.resource_id && update.resource_id !== prevRow.resource_id) {
      summary.push(`room: ${prevRow.resource_id} → ${update.resource_id}`)
    }
    if (update.during) summary.push('time rescheduled')
    if (
      update.price_cents !== undefined &&
      update.price_cents !== prevRow.price_cents
    ) {
      summary.push(
        `price: ${prevRow.price_cents} → ${update.price_cents} cents`
      )
    }
    if (update.notes !== undefined) summary.push('notes updated')
    if (summary.length > 0) {
      await admin.from('admin_notes').insert({
        user_id: prevRow.user_id,
        author_id: auth.adminId,
        body: `Admin edited booking ${data.bookingId} — ${summary.join('; ')}.`,
      })
    }
  }

  revalidatePath('/admin/bookings')
  revalidatePath(`/admin/bookings/${data.bookingId}`)
  if (prevRow.user_id) {
    revalidatePath(`/admin/members/${prevRow.user_id}`)
    revalidatePath('/dashboard/bookings')
  }
  return { ok: true }
}

// =====================================================================
// Admin-on-behalf booking
//
// Creates a confirmed booking for a member or a guest, optionally
// recording a paid payment alongside. Mirrors the server-side checkout
// flow but skips the Wam intent — admin handles payment offline.
// =====================================================================

const slotSchema = z.object({
  startIso: z.string().min(1),
  endIso: z.string().min(1),
})

const memberBookingSchema = z.object({
  mode: z.literal('member'),
  userId: z.string().uuid(),
})

const guestBookingSchema = z.object({
  mode: z.literal('guest'),
  guestName: z.string().trim().min(1).max(120),
  // Email is optional — admin records the guest's email when they have
  // it, but walk-ins sometimes don't provide one.
  guestEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Invalid email'),
  guestPhone: z.string().trim().max(40).optional().nullable(),
})

const createBookingSchema = z
  .object({
    resourceId: z.string().min(1),
    // 26 half-hour slots = a full 8am-to-9pm day on one booking.
    slots: z.array(slotSchema).min(1).max(26),
    // 'plan' = cover the booking from the member's plan room benefits
    // and meeting credits (member mode only, must cover it fully).
    paymentStatus: z.enum(['paid', 'unpaid', 'plan']),
    paymentMethod: z
      .enum(['cash', 'wam_pos', 'bank_transfer', 'other'])
      .optional()
      .nullable(),
    amountCentsOverride: z.number().int().min(0).nullable().optional(),
    externalRef: z.string().max(200).optional().nullable(),
    note: z.string().max(500).optional().nullable(),
    // Group bookings: how many people check in against this booking.
    groupSize: z.number().int().min(2).max(50).nullable().optional(),
  })
  .and(z.union([memberBookingSchema, guestBookingSchema]))

export type AdminCreateBookingInput = z.infer<typeof createBookingSchema>

export type AdminCreateBookingResult =
  | { ok: true; bookingGroupId: string; bookingCount: number }
  | { ok: false; error: string }

export async function adminCreateBooking(
  input: AdminCreateBookingInput
): Promise<AdminCreateBookingResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = createBookingSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  // Validate slots — same checks as the self-serve route.
  const now = Date.now()
  for (const slot of data.slots) {
    const start = new Date(slot.startIso).getTime()
    const end = new Date(slot.endIso).getTime()
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return { ok: false, error: 'Invalid slot time' }
    }
    if (end <= start) {
      return { ok: false, error: 'Slot end must be after start' }
    }
    if (end < now) {
      return { ok: false, error: 'Slot is in the past' }
    }
  }

  const admin = createAdminClient()
  // No is_bookable filter here: admins can place specialized bookings —
  // the Main Space for an event, the rooftop, spaces the public site
  // doesn't sell. The exclusion constraint still guards conflicts.
  const { data: resourceRow } = await admin
    .from('resources')
    .select(
      'id, name, price_per_hour_cents, after_hours_price_per_hour_cents, after_hours_starts_at_hour, currency, is_bookable'
    )
    .eq('id', data.resourceId)
    .maybeSingle()
  if (!resourceRow) {
    return { ok: false, error: 'Resource not found' }
  }
  const resource = resourceRow as {
    id: string
    name: string
    price_per_hour_cents: number | null
    after_hours_price_per_hour_cents: number | null
    after_hours_starts_at_hour: number | null
    currency: string
  }

  // Auto-compute total via the shared helper (handles tiered pricing
  // when after_hours_* columns are set). Override still wins.
  const autoCents = priceSlotsCents(resource, data.slots)
  let totalCents =
    typeof data.amountCentsOverride === 'number'
      ? data.amountCentsOverride
      : autoCents

  // Plan coverage: same all-or-nothing rule as member self-serve —
  // plan benefits first, then meeting credits for the remainder. If the
  // combination can't cover every slot, report exactly what's short so
  // the admin can switch to paid/unpaid instead.
  let planCovered: boolean[] | null = null
  let consumedCredits: ConsumedCredit[] = []
  if (data.paymentStatus === 'plan') {
    if (data.mode !== 'member') {
      return {
        ok: false,
        error: 'Plan coverage only works for member bookings',
      }
    }
    const coverage = await computePlanCoverage(admin, {
      userId: data.userId,
      resourceId: resource.id,
      slots: data.slots,
    })
    const uncoveredHours = data.slots.reduce((sum, slot, i) => {
      if (coverage.covered[i]) return sum
      return (
        sum +
        (new Date(slot.endIso).getTime() - new Date(slot.startIso).getTime()) /
          (60 * 60 * 1000)
      )
    }, 0)
    if (uncoveredHours > 0) {
      const creditHours = await remainingRoomHours(
        admin,
        data.userId,
        resource.id
      )
      if (creditHours < uncoveredHours) {
        return {
          ok: false,
          error: `Plan and credits don't cover this booking: plan covers ${coverage.coveredHours}h, ${uncoveredHours}h left but only ${creditHours}h of meeting credits available. Use Paid or Unpaid instead.`,
        }
      }
      const consumed = await consumeRoomHours(
        admin,
        data.userId,
        resource.id,
        uncoveredHours
      )
      if (!consumed.ok) {
        return {
          ok: false,
          error: 'Could not reserve the meeting credits — try again',
        }
      }
      consumedCredits = consumed.consumed
    }
    planCovered = coverage.covered
    totalCents = 0
  }

  // Booking group — admin-on-behalf groups may be guest-attached.
  const groupInsert: Record<string, unknown> = {
    user_id: data.mode === 'member' ? data.userId : null,
    total_cents: totalCents,
    currency: resource.currency,
    status: 'confirmed',
    expires_at: new Date(now + 60 * 60 * 1000).toISOString(),
  }
  if (data.mode === 'guest') {
    groupInsert.guest_name = data.guestName
    groupInsert.guest_email = data.guestEmail
      ? data.guestEmail.toLowerCase()
      : null
    groupInsert.guest_phone = data.guestPhone?.trim() || null
  }

  const { data: groupRow, error: groupErr } = await admin
    .from('booking_groups')
    .insert(groupInsert)
    .select('id')
    .single()
  if (groupErr || !groupRow) {
    console.error('[admin/createBooking] group insert failed:', groupErr)
    await refundRoomHours(admin, consumedCredits)
    return { ok: false, error: 'Could not create booking group' }
  }
  const groupId = (groupRow as { id: string }).id

  // Optional payment row.
  let paymentId: string | null = null
  if (data.paymentStatus === 'paid') {
    if (!data.paymentMethod) {
      // Roll back the group we just created so we don't orphan it.
      await admin.from('booking_groups').delete().eq('id', groupId)
      return {
        ok: false,
        error: 'Pick a payment method for paid bookings.',
      }
    }
    const paymentInsert: Record<string, unknown> = {
      user_id: data.mode === 'member' ? data.userId : null,
      amount_cents: totalCents,
      currency: resource.currency,
      status: 'succeeded',
      kind: 'booking',
      payment_method: data.paymentMethod,
      external_ref: data.externalRef?.trim() || null,
      recorded_by: auth.adminId,
      paid_at: new Date().toISOString(),
      metadata: {
        manual: true,
        bookingGroupId: groupId,
        resourceId: resource.id,
        slotCount: data.slots.length,
        note: data.note ?? null,
        amountAutoCents: autoCents,
        amountOverride:
          typeof data.amountCentsOverride === 'number' &&
          data.amountCentsOverride !== autoCents,
        guestName: data.mode === 'guest' ? data.guestName : null,
        guestEmail: data.mode === 'guest' ? data.guestEmail : null,
      },
    }
    const { data: paymentRow, error: paymentErr } = await admin
      .from('payments')
      .insert(paymentInsert)
      .select('id')
      .single()
    if (paymentErr || !paymentRow) {
      console.error('[admin/createBooking] payment insert failed:', paymentErr)
      await admin.from('booking_groups').delete().eq('id', groupId)
      return { ok: false, error: 'Could not record payment' }
    }
    paymentId = (paymentRow as { id: string }).id
    await admin
      .from('booking_groups')
      .update({ payment_id: paymentId })
      .eq('id', groupId)
  }

  // Insert each booking as confirmed. Exclusion constraint catches
  // conflicts — if any slot conflicts we roll back everything inserted
  // so far.
  let insertedCount = 0
  for (const [slotIndex, slot] of data.slots.entries()) {
    const slotHours =
      (new Date(slot.endIso).getTime() - new Date(slot.startIso).getTime()) /
      (60 * 60 * 1000)
    const slotPriceCents =
      planCovered !== null
        ? 0
        : Math.round(slotHours * rateForSlotCents(resource, slot.startIso))

    const bookingInsert: Record<string, unknown> = {
      user_id: data.mode === 'member' ? data.userId : null,
      resource_id: resource.id,
      during: `[${slot.startIso},${slot.endIso})`,
      status: 'confirmed',
      price_cents: slotPriceCents,
      payment_id: paymentId,
      group_size: data.groupSize ?? null,
      booking_group_id: groupId,
      // Plan-benefit slots are stamped so monthly usage stays computable;
      // credit-consumed slots aren't (their hours live in the credit rows).
      covered_by_plan: planCovered !== null && planCovered[slotIndex] === true,
    }
    if (data.mode === 'guest') {
      bookingInsert.guest_name = data.guestName
      // bookings table CHECK requires either user_id OR (guest_email +
      // guest_name). Substitute a clearly-internal placeholder when no
      // email is provided so the constraint is satisfied; admin views
      // can detect this prefix to suppress UI for it.
      bookingInsert.guest_email = data.guestEmail
        ? data.guestEmail.toLowerCase()
        : `walk-in+${groupId}@theworx.local`
    }

    const { error: bookingErr } = await admin
      .from('bookings')
      .insert(bookingInsert)
    if (bookingErr) {
      console.error('[admin/createBooking] booking insert failed:', bookingErr)
      // Roll back everything inserted in this batch + the group + payment.
      await admin.from('bookings').delete().eq('booking_group_id', groupId)
      if (paymentId) {
        await admin.from('payments').delete().eq('id', paymentId)
      }
      await admin.from('booking_groups').delete().eq('id', groupId)
      await refundRoomHours(admin, consumedCredits)
      const isConflict = (bookingErr as { code?: string }).code === '23P01'
      return {
        ok: false,
        error: isConflict
          ? 'One of those slots was just booked. Refresh and pick another time.'
          : 'Could not save the booking',
      }
    }
    insertedCount++
  }

  // Audit trail for member bookings.
  if (data.mode === 'member' && (data.note?.trim() || planCovered !== null)) {
    const creditHoursUsed = consumedCredits.reduce((s, c) => s + c.hours, 0)
    const coverageNote =
      planCovered !== null
        ? ` Covered from plan${creditHoursUsed > 0 ? ` + ${creditHoursUsed}h meeting credits` : ''}.`
        : ''
    await admin.from('admin_notes').insert({
      user_id: data.userId,
      author_id: auth.adminId,
      body: `Admin booked ${resource.name} (${insertedCount} slot${
        insertedCount === 1 ? '' : 's'
      }).${coverageNote}${data.note?.trim() ? ` ${data.note.trim()}` : ''}`,
    })
  }

  revalidatePath('/admin/bookings')
  revalidatePath('/admin')
  if (data.mode === 'member') {
    revalidatePath(`/admin/members/${data.userId}`)
    revalidatePath('/dashboard/bookings')
  }

  return {
    ok: true,
    bookingGroupId: groupId,
    bookingCount: insertedCount,
  }
}

// =====================================================================
// Paid flag + arrival check-in. A booking counts as paid when it has an
// online payment (payment_id) or an admin marked it paid (paid_at).
// =====================================================================

const bookingIdSchema = z.object({ bookingId: z.string().uuid() })

export async function adminSetBookingPaid(input: {
  bookingId: string
  paid: boolean
}): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let bookingId
  try {
    bookingId = bookingIdSchema.parse({ bookingId: input.bookingId }).bookingId
  } catch {
    return { ok: false, error: 'Invalid booking' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('bookings')
    .update({ paid_at: input.paid ? new Date().toISOString() : null })
    .eq('id', bookingId)
  if (error) {
    console.error('[admin/setBookingPaid] failed:', error)
    return { ok: false, error: 'Could not update paid status' }
  }

  revalidatePath('/admin/bookings')
  revalidatePath(`/admin/bookings/${bookingId}`)
  return { ok: true }
}

export async function adminCheckInBooking(input: {
  bookingId: string
}): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let bookingId
  try {
    bookingId = bookingIdSchema.parse({ bookingId: input.bookingId }).bookingId
  } catch {
    return { ok: false, error: 'Invalid booking' }
  }

  const admin = createAdminClient()
  const result = await checkInBookingArrival(admin, bookingId)
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === 'not_found'
          ? 'Booking not found'
          : result.error === 'already_checked_in'
            ? 'Already checked in'
            : 'Could not check in',
    }
  }

  revalidatePath('/admin/bookings')
  revalidatePath(`/admin/bookings/${bookingId}`)
  revalidatePath('/admin')
  revalidatePath('/admin/checkin/visits')
  return { ok: true }
}

export async function adminSendBookingReminder(input: {
  bookingId: string
}): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let bookingId
  try {
    bookingId = bookingIdSchema.parse({ bookingId: input.bookingId }).bookingId
  } catch {
    return { ok: false, error: 'Invalid booking' }
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('bookings')
    .select(
      'id, during, price_cents, payment_id, paid_at, user_id, guest_name, guest_email, resources(name), profiles(full_name, email)'
    )
    .eq('id', bookingId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Booking not found' }
  const b = row as {
    id: string
    during: string
    price_cents: number
    payment_id: string | null
    paid_at: string | null
    user_id: string | null
    guest_name: string | null
    guest_email: string | null
    resources: { name?: string } | { name?: string }[] | null
    profiles:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null
  }

  if (b.payment_id || b.paid_at) {
    return { ok: false, error: 'This booking is already paid' }
  }
  if (b.price_cents <= 0) {
    return { ok: false, error: 'Nothing owed on this booking' }
  }

  const profRaw = b.profiles
  const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
  const email = profile?.email ?? b.guest_email
  if (!email || email.includes('@theworx.local')) {
    return { ok: false, error: 'No usable email on this booking' }
  }
  const resRaw = b.resources
  const resourceName =
    (Array.isArray(resRaw) ? resRaw[0]?.name : resRaw?.name) ?? 'room'
  const range = parseTstzRange(b.during)
  if (!range) return { ok: false, error: 'Booking has no valid time' }
  const firstName = (profile?.full_name ?? b.guest_name ?? '')
    .trim()
    .split(/\s+/)[0]

  const sent = await sendBookingPaymentReminder({
    to: email,
    firstName: firstName || null,
    resourceName,
    startIso: range.during_lower,
    amountCents: b.price_cents,
  })
  if (!sent) {
    return { ok: false, error: 'Email could not be sent — try again' }
  }

  // Mirror as an in-app message for members so it also shows on their
  // dashboard.
  if (b.user_id) {
    await sendMemberNotification(admin, {
      userId: b.user_id,
      title: `Payment reminder — ${resourceName} booking`,
      body: `Your ${resourceName} booking has a balance of TTD $${(b.price_cents / 100).toFixed(0)}. You can settle at the front desk or online.`,
      createdBy: auth.adminId,
    })
  }

  return { ok: true }
}
