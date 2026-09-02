'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { parseTstzRange } from '@/lib/booking/slots'
import { issueCreditGrant } from '@/lib/credits/balance'

const cancelSchema = z.object({
  bookingId: z.string().uuid(),
})

export type CancelBookingResult = { ok: true } | { ok: false; error: string }

// Minimum window before booking start time. Inside this window, members can't
// self-cancel — they need to email the team.
const CANCEL_CUTOFF_MINUTES = 60

export async function cancelBooking(
  input: z.infer<typeof cancelSchema>
): Promise<CancelBookingResult> {
  let data
  try {
    data = cancelSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid request' }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  // Load the booking via user-scoped client (RLS makes sure it's theirs).
  const { data: booking, error: loadErr } = await supabase
    .from('bookings')
    .select('id, user_id, status, during')
    .eq('id', data.bookingId)
    .maybeSingle()

  if (loadErr || !booking) {
    return { ok: false, error: 'Booking not found' }
  }

  const row = booking as Record<string, unknown>
  if (row.user_id !== user.id) {
    return { ok: false, error: 'Not your booking' }
  }
  if (row.status !== 'confirmed' && row.status !== 'held') {
    return {
      ok: false,
      error: `Cannot cancel a ${row.status} booking`,
    }
  }

  const range = parseTstzRange(row.during as string)
  if (!range) return { ok: false, error: 'Booking time is invalid' }
  const startMs = new Date(range.during_lower).getTime()
  const minutesUntilStart = (startMs - Date.now()) / 60000
  if (minutesUntilStart < CANCEL_CUTOFF_MINUTES) {
    return {
      ok: false,
      error: `Bookings can only be cancelled at least ${CANCEL_CUTOFF_MINUTES} minutes in advance. Email team@theworx.io for late cancellations.`,
    }
  }

  // Use admin client to bypass the exclusion-constraint check on bookings
  // (cancelled bookings don't participate, so this is fine, but writes are
  // gated by RLS bookings_admin_write — the user can't update via supabase
  // client directly).
  const admin = createAdminClient()
  const { error: updateErr } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', data.bookingId)
    .eq('user_id', user.id) // belt + suspenders

  if (updateErr) {
    console.error('[bookings/cancel] update failed:', updateErr)
    return { ok: false, error: 'Could not cancel. Try again.' }
  }

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard')
  return { ok: true }
}

// =====================================================================
// Reduce or cancel a whole booking run (the contiguous slots of one
// checkout). Paid time that's given up comes back as ACCOUNT CREDIT —
// never a card refund. Members wanting a real refund email
// team@theworx.io.
// =====================================================================

const manageSchema = z.object({
  bookingIds: z.array(z.string().uuid()).min(1).max(32),
  // Keep slots that END at or before this instant; drop the rest.
  // Absent = cancel the entire run.
  keepUntilIso: z.string().optional(),
})

export type ReduceBookingResult =
  | { ok: true; cancelledCount: number; creditedCents: number }
  | { ok: false; error: string }

export async function reduceBookingRun(
  input: z.infer<typeof manageSchema>
): Promise<ReduceBookingResult> {
  let data
  try {
    data = manageSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid request' }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  // RLS scopes this to the member's own bookings.
  const { data: rows, error: loadErr } = await supabase
    .from('bookings')
    .select(
      'id, user_id, status, during, price_cents, payment_id, booking_group_id, covered_by_plan, resources(name)'
    )
    .in('id', data.bookingIds)
  if (loadErr || !rows || rows.length !== data.bookingIds.length) {
    return { ok: false, error: 'Booking not found' }
  }

  type Row = {
    id: string
    user_id: string
    status: string
    during: string
    price_cents: number
    payment_id: string | null
    booking_group_id: string | null
    covered_by_plan: boolean
    resources: { name?: string } | { name?: string }[] | null
  }
  const bookings = (rows as Row[]).map((r) => {
    const range = parseTstzRange(r.during)
    return { ...r, range }
  })

  const groupId = bookings[0].booking_group_id
  for (const b of bookings) {
    if (b.user_id !== user.id) return { ok: false, error: 'Not your booking' }
    if (b.status !== 'confirmed') {
      return { ok: false, error: 'Only confirmed bookings can be changed' }
    }
    if (!b.range) return { ok: false, error: 'Booking time is invalid' }
    if (b.booking_group_id !== groupId) {
      return { ok: false, error: 'Slots belong to different bookings' }
    }
  }

  const keepUntilMs = data.keepUntilIso
    ? new Date(data.keepUntilIso).getTime()
    : null
  if (keepUntilMs !== null && Number.isNaN(keepUntilMs)) {
    return { ok: false, error: 'Invalid time' }
  }

  const dropped = bookings.filter(
    (b) =>
      keepUntilMs === null ||
      new Date(b.range!.during_lower).getTime() >= keepUntilMs
  )
  if (dropped.length === 0) {
    return { ok: false, error: 'Nothing to change — pick an earlier end time' }
  }

  // Same cutoff as cancellation: changes at least 60 minutes before the
  // first affected slot.
  for (const b of dropped) {
    const minutesUntil =
      (new Date(b.range!.during_lower).getTime() - Date.now()) / 60000
    if (minutesUntil < CANCEL_CUTOFF_MINUTES) {
      return {
        ok: false,
        error: `Changes need at least ${CANCEL_CUTOFF_MINUTES} minutes notice. Email team@theworx.io and we'll sort it out.`,
      }
    }
  }

  const admin = createAdminClient()
  const droppedIds = dropped.map((b) => b.id)
  const { error: updateErr } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .in('id', droppedIds)
    .eq('user_id', user.id)
  if (updateErr) {
    console.error('[bookings/reduce] update failed:', updateErr)
    return { ok: false, error: 'Could not update the booking. Try again.' }
  }

  // Credit the paid portion of what was given up. Only if the money
  // actually arrived (payment succeeded); plan-covered slots were free
  // and their hours return to the allowance automatically.
  let creditedCents = 0
  const paidDropped = dropped.filter(
    (b) => b.price_cents > 0 && b.payment_id !== null
  )
  if (paidDropped.length > 0) {
    const { data: paymentRow } = await admin
      .from('payments')
      .select('status')
      .eq('id', paidDropped[0].payment_id!)
      .maybeSingle()
    if ((paymentRow as { status?: string } | null)?.status === 'succeeded') {
      creditedCents = paidDropped.reduce((sum, b) => sum + b.price_cents, 0)
      const resRaw = bookings[0].resources
      const resourceName =
        (Array.isArray(resRaw) ? resRaw[0]?.name : resRaw?.name) ?? 'room'
      const expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      const grant = await issueCreditGrant(admin, {
        userId: user.id,
        recipientEmail: null,
        amountCents: creditedCents,
        reason: 'refund_as_credit',
        reasonNote: `Booking time ${keepUntilMs === null ? 'cancelled' : 'reduced'} — ${resourceName}`,
        expiresAt,
        issuedBy: user.id,
      })
      if (!grant.ok) {
        console.error('[bookings/reduce] credit grant failed:', grant.error)
        creditedCents = 0
      }
    }
  }

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard')
  revalidatePath('/admin/bookings')
  return { ok: true, cancelledCount: dropped.length, creditedCents }
}
