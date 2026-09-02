'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/utils/supabase/admin'
import { assertTeam } from '@/lib/auth/assert'
import { spendSession } from '@/lib/sessions/ledger'

export type CoachActionResult = { ok: true } | { ok: false; error: string }

async function coachResourceFor(
  admin: ReturnType<typeof createAdminClient>,
  coachId: string
): Promise<{ resourceId: string } | null> {
  const { data } = await admin
    .from('resources')
    .select('id')
    .eq('coach_id', coachId)
    .eq('kind', 'pt')
    .maybeSingle()
  return data ? { resourceId: (data as { id: string }).id } : null
}

// Only the coach who owns the slot (or an owner) can settle a session.
async function loadOwnBooking(
  admin: ReturnType<typeof createAdminClient>,
  bookingId: string,
  callerId: string,
  role: string
) {
  const { data } = await admin
    .from('bookings')
    .select('id, user_id, status, checked_in_at, resource_id, resources(coach_id)')
    .eq('id', bookingId)
    .maybeSingle()
  if (!data) return null
  const row = data as {
    id: string
    user_id: string | null
    status: string
    checked_in_at: string | null
    resource_id: string
    resources: { coach_id?: string | null } | { coach_id?: string | null }[] | null
  }
  const res = Array.isArray(row.resources) ? (row.resources[0] ?? null) : row.resources
  const isMine = res?.coach_id === callerId
  const isOwnerRole = role === 'owner' || role === 'admin'
  if (!isMine && !isOwnerRole) return null
  return row
}

const settleSchema = z.object({
  bookingId: z.string().uuid(),
  outcome: z.enum(['delivered', 'no_show']),
})

export async function coachSettleSession(
  input: z.infer<typeof settleSchema>
): Promise<CoachActionResult> {
  const auth = await assertTeam()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = settleSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid request' }
  }
  const admin = createAdminClient()
  const booking = await loadOwnBooking(admin, data.bookingId, auth.adminId, auth.role)
  if (!booking) return { ok: false, error: 'Not your session' }
  if (booking.status !== 'confirmed') {
    return { ok: false, error: `Already ${booking.status.replace('_', ' ')}` }
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('bookings')
    .update(
      data.outcome === 'delivered'
        ? {
            status: 'completed',
            checked_in_at: booking.checked_in_at ?? now,
            checkin_count: 1,
          }
        : { status: 'no_show' }
    )
    .eq('id', booking.id)
    .eq('status', 'confirmed')
  if (error) return { ok: false, error: 'Could not update the session' }

  // Spend the session if the iPad didn't already (no ledger row for it).
  if (booking.user_id) {
    const { data: spent } = await admin
      .from('session_ledger')
      .select('id')
      .eq('booking_id', booking.id)
      .lt('delta', 0)
      .limit(1)
    if (!spent || spent.length === 0) {
      await spendSession(admin, {
        userId: booking.user_id,
        kind: 'pt',
        reason: data.outcome === 'delivered' ? 'booking_use' : 'no_show',
        bookingId: booking.id,
        createdBy: auth.adminId,
      })
    }
  }

  revalidatePath('/coach')
  revalidatePath('/admin/bookings')
  return { ok: true }
}

// ---- availability ----

const availabilitySchema = z.object({
  windows: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startMinute: z.number().int().min(0).max(1439),
        endMinute: z.number().int().min(1).max(1440),
      })
    )
    .max(21)
    .refine((ws) => ws.every((w) => w.endMinute > w.startMinute), {
      message: 'End must be after start',
    }),
})

export async function coachSaveAvailability(
  input: z.infer<typeof availabilitySchema>
): Promise<CoachActionResult> {
  const auth = await assertTeam()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = availabilitySchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError ? (err.issues[0]?.message ?? 'Invalid') : 'Invalid'
    return { ok: false, error: msg }
  }
  const admin = createAdminClient()
  const coach = await coachResourceFor(admin, auth.adminId)
  if (!coach) return { ok: false, error: 'No coach profile on this account' }

  const { error: delErr } = await admin
    .from('coach_availability')
    .delete()
    .eq('coach_id', auth.adminId)
  if (delErr) return { ok: false, error: 'Could not save availability' }
  if (data.windows.length > 0) {
    const { error } = await admin.from('coach_availability').insert(
      data.windows.map((w) => ({
        coach_id: auth.adminId,
        weekday: w.weekday,
        start_minute: w.startMinute,
        end_minute: w.endMinute,
      }))
    )
    if (error) return { ok: false, error: 'Could not save availability' }
  }
  revalidatePath('/coach/availability')
  return { ok: true }
}

const blockSchema = z.object({
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  reason: z.string().trim().max(120).optional().nullable(),
})

export async function coachAddBlock(
  input: z.infer<typeof blockSchema>
): Promise<CoachActionResult> {
  const auth = await assertTeam()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = blockSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid dates' }
  }
  const starts = new Date(data.startsAt)
  const ends = new Date(data.endsAt)
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    return { ok: false, error: 'End must be after start' }
  }
  const admin = createAdminClient()
  const { error } = await admin.from('coach_blocks').insert({
    coach_id: auth.adminId,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    reason: data.reason?.trim() || null,
  })
  if (error) return { ok: false, error: 'Could not add the block' }
  revalidatePath('/coach/availability')
  return { ok: true }
}

export async function coachRemoveBlock(input: {
  blockId: string
}): Promise<CoachActionResult> {
  const auth = await assertTeam()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!z.string().uuid().safeParse(input.blockId).success) {
    return { ok: false, error: 'Invalid block' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('coach_blocks')
    .delete()
    .eq('id', input.blockId)
    .eq('coach_id', auth.adminId)
  if (error) return { ok: false, error: 'Could not remove the block' }
  revalidatePath('/coach/availability')
  return { ok: true }
}

// ---- rent pool ----

const poolSchema = z.object({
  amountCents: z.number().int().min(100).max(100_000_000),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  note: z.string().trim().max(200).optional().nullable(),
})

export async function coachAddPoolContribution(
  input: z.infer<typeof poolSchema>
): Promise<CoachActionResult> {
  const auth = await assertTeam()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = poolSchema.parse(input)
  } catch {
    return { ok: false, error: 'Enter an amount and month' }
  }
  const admin = createAdminClient()
  const { error } = await admin.from('pool_contributions').insert({
    coach_id: auth.adminId,
    amount_cents: data.amountCents,
    month: `${data.month}-01`,
    note: data.note?.trim() || null,
  })
  if (error) return { ok: false, error: 'Could not record the contribution' }
  revalidatePath('/coach/earnings')
  revalidatePath('/admin/finance')
  return { ok: true }
}
