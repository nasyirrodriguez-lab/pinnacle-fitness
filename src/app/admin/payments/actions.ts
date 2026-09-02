'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isOwner } from '@/lib/auth/roles'
import { getWam } from '@/lib/wam/client'
import {
  confirmBookingGroupFromMetadata,
  grantPassFromMetadata,
  grantSubscriptionFromMetadata,
} from '@/lib/payments/provision'

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

const markRefundedSchema = z.object({
  paymentId: z.string().uuid(),
})

// The Wam SDK we depend on doesn't expose a refund API. Refunds must be
// issued through Wam's dashboard first; this action just reconciles our DB
// state afterward. It is NOT a "press to refund" — it's "I refunded this
// in Wam, sync our record."
export async function adminMarkRefunded(
  input: z.infer<typeof markRefundedSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = markRefundedSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid request' }
  }

  const admin = createAdminClient()

  const { data: payment, error: loadErr } = await admin
    .from('payments')
    .select('id, user_id, status, wam_payment_id')
    .eq('id', data.paymentId)
    .maybeSingle()
  if (loadErr || !payment) {
    return { ok: false, error: 'Payment not found' }
  }
  const row = payment as Record<string, unknown>
  if (row.status !== 'succeeded') {
    return {
      ok: false,
      error: `Cannot refund a ${row.status} payment`,
    }
  }

  const { error: updateErr } = await admin
    .from('payments')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
    })
    .eq('id', data.paymentId)
  if (updateErr) {
    console.error('[admin/markRefunded] update failed:', updateErr)
    return { ok: false, error: 'Could not mark refunded' }
  }

  const userId = row.user_id as string | null
  const wamId = row.wam_payment_id as string | null
  if (userId) {
    await admin.from('admin_notes').insert({
      user_id: userId,
      author_id: auth.adminId,
      body: `Marked payment ${data.paymentId} as refunded${
        wamId ? ` (Wam: ${wamId})` : ''
      }.`,
    })
  }

  revalidatePath('/admin/payments')
  if (userId) revalidatePath(`/admin/members/${userId}`)
  revalidatePath('/dashboard/invoices')
  return { ok: true }
}

// =====================================================================
// Backfill / correct the date a payment was made. Changes paid_at only
// — amount, status, and the audit trail (created_at) stay untouched.
// =====================================================================

const setDateSchema = z.object({
  paymentId: z.string().uuid(),
  paidAtIso: z
    .string()
    .min(1)
    .refine((v) => !Number.isNaN(new Date(v).getTime()), {
      message: 'Invalid date',
    }),
})

export async function adminSetPaymentDate(
  input: z.infer<typeof setDateSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = setDateSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const paidAt = new Date(data.paidAtIso)
  if (paidAt.getTime() > Date.now()) {
    return { ok: false, error: 'Payment date cannot be in the future' }
  }

  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from('payments')
    .update({ paid_at: paidAt.toISOString() })
    .eq('id', data.paymentId)
    .select('user_id')
    .maybeSingle()
  if (error || !updated) {
    console.error('[admin/setPaymentDate] failed:', error)
    return { ok: false, error: 'Could not update the date' }
  }

  const userId = (updated as { user_id: string | null }).user_id
  if (userId) {
    await admin.from('admin_notes').insert({
      user_id: userId,
      author_id: auth.adminId,
      body: `Admin changed payment ${data.paymentId} date to ${paidAt.toISOString().slice(0, 16)}.`,
    })
  }

  revalidatePath('/admin/payments')
  if (userId) revalidatePath(`/admin/members/${userId}`)
  return { ok: true }
}

// =====================================================================
// Confirm a "pay cash at the front desk" reservation: the member handed
// over the cash, an admin confirms, the product activates.
// =====================================================================

const confirmCashSchema = z.object({
  paymentId: z.string().uuid(),
})

export async function adminConfirmCashPayment(
  input: z.infer<typeof confirmCashSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = confirmCashSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid request' }
  }

  const admin = createAdminClient()
  const { data: paymentRaw } = await admin
    .from('payments')
    .select('id, user_id, status, kind, metadata, payment_method')
    .eq('id', data.paymentId)
    .maybeSingle()
  if (!paymentRaw) return { ok: false, error: 'Payment not found' }
  const payment = paymentRaw as {
    id: string
    user_id: string | null
    status: string
    kind: string
    metadata: Record<string, unknown> | null
    payment_method: string | null
  }
  if (payment.status !== 'pending') {
    return { ok: false, error: `Payment is already ${payment.status}` }
  }
  if (payment.payment_method !== 'cash') {
    return { ok: false, error: 'Not a cash reservation' }
  }

  const { error: updErr } = await admin
    .from('payments')
    .update({
      status: 'succeeded',
      paid_at: new Date().toISOString(),
      recorded_by: auth.adminId,
    })
    .eq('id', payment.id)
    .eq('status', 'pending')
  if (updErr) {
    return { ok: false, error: 'Could not update the payment' }
  }

  const metadata = payment.metadata ?? {}
  let provisionNote = ''
  if (payment.kind === 'pass' && payment.user_id) {
    const passId = typeof metadata.passId === 'string' ? metadata.passId : null
    if (passId) {
      const r = await grantPassFromMetadata(admin, {
        userId: payment.user_id,
        passId,
        paymentId: payment.id,
      })
      if (!r.ok) provisionNote = ` Pass grant failed: ${r.error}.`
    }
  } else if (payment.kind === 'subscription' && payment.user_id) {
    const planId = typeof metadata.planId === 'string' ? metadata.planId : null
    if (planId) {
      const isVirtualOffice =
        metadata.virtualOffice === true ||
        metadata.virtualOffice === 'true' ||
        planId === 'virtual-office-monthly'
      const r = await grantSubscriptionFromMetadata(admin, {
        userId: payment.user_id,
        planId,
        isVirtualOffice,
      })
      if (!r.ok) provisionNote = ` Subscription grant failed: ${r.error}.`
    }
  }

  if (payment.user_id) {
    await admin.from('admin_notes').insert({
      user_id: payment.user_id,
      author_id: auth.adminId,
      body: `Confirmed cash payment ${payment.id} at the front desk.${provisionNote}`,
    })
  }

  revalidatePath('/admin/payments')
  if (payment.user_id) revalidatePath(`/admin/members/${payment.user_id}`)
  if (provisionNote) {
    return {
      ok: false,
      error: `Payment confirmed, but provisioning hit a problem:${provisionNote}`,
    }
  }
  return { ok: true }
}

// =====================================================================
// Explicit, admin-initiated confirmation of a pending Wam payment.
// Automatic confirmation is webhook-only; this is the human override for
// payments Wam's API reports as succeeded (money captured, settling)
// where the webhook hasn't arrived. It re-checks Wam live and refuses
// to confirm anything Wam doesn't report as succeeded.
// =====================================================================

const verifyWamSchema = z.object({
  paymentId: z.string().uuid(),
})

export type VerifyWamResult =
  | { ok: true }
  | { ok: false; error: string; wamStatus?: string }

export async function adminVerifyWamPayment(
  input: z.infer<typeof verifyWamSchema>
): Promise<VerifyWamResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = verifyWamSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid request' }
  }

  const admin = createAdminClient()
  const { data: paymentRaw, error: loadErr } = await admin
    .from('payments')
    .select('id, user_id, status, kind, metadata, wam_payment_id')
    .eq('id', data.paymentId)
    .maybeSingle()
  if (loadErr || !paymentRaw) return { ok: false, error: 'Payment not found' }

  const payment = paymentRaw as {
    id: string
    user_id: string | null
    status: string
    kind: string
    metadata: Record<string, unknown> | null
    wam_payment_id: string | null
  }
  if (payment.status !== 'pending') {
    return { ok: false, error: `Payment is already ${payment.status}` }
  }
  if (!payment.wam_payment_id) {
    return { ok: false, error: 'No Wam intent on this payment' }
  }

  let wamStatus
  try {
    wamStatus = await getWam().getPaymentIntentStatus(payment.wam_payment_id)
  } catch (err) {
    console.error('[admin/verifyWam] wam lookup failed:', err)
    return { ok: false, error: 'Could not reach Wam — try again' }
  }
  if (wamStatus.status !== 'succeeded') {
    return {
      ok: false,
      error: `Wam reports "${wamStatus.status}" — not confirming`,
      wamStatus: wamStatus.status,
    }
  }

  const paidAt = wamStatus.completedAt ?? new Date().toISOString()
  const { error: updErr } = await admin
    .from('payments')
    .update({ status: 'succeeded', paid_at: paidAt })
    .eq('id', payment.id)
    .eq('status', 'pending')
  if (updErr) {
    console.error('[admin/verifyWam] update failed:', updErr)
    return { ok: false, error: 'Could not update the payment' }
  }

  const metadata = payment.metadata ?? {}
  let provisionNote = ''
  if (payment.kind === 'pass' && payment.user_id) {
    const passId = typeof metadata.passId === 'string' ? metadata.passId : null
    if (passId) {
      const r = await grantPassFromMetadata(admin, {
        userId: payment.user_id,
        passId,
        paymentId: payment.id,
      })
      if (!r.ok) provisionNote = ` Pass grant failed: ${r.error}.`
    }
  } else if (payment.kind === 'subscription' && payment.user_id) {
    const planId = typeof metadata.planId === 'string' ? metadata.planId : null
    if (planId) {
      const isVirtualOffice =
        metadata.virtualOffice === true ||
        metadata.virtualOffice === 'true' ||
        planId === 'virtual-office-monthly'
      const r = await grantSubscriptionFromMetadata(admin, {
        userId: payment.user_id,
        planId,
        isVirtualOffice,
      })
      if (!r.ok) provisionNote = ` Subscription grant failed: ${r.error}.`
    }
  } else if (payment.kind === 'booking') {
    const groupId =
      typeof metadata.bookingGroupId === 'string'
        ? metadata.bookingGroupId
        : null
    if (groupId) {
      const r = await confirmBookingGroupFromMetadata(admin, {
        bookingGroupId: groupId,
      })
      if (!r.ok) provisionNote = ` Booking confirm failed: ${r.error}.`
    }
  }

  if (payment.user_id) {
    await admin.from('admin_notes').insert({
      user_id: payment.user_id,
      author_id: auth.adminId,
      body: `Verified Wam payment ${payment.id} against Wam (status succeeded) and confirmed it.${provisionNote}`,
    })
  }

  revalidatePath('/admin/payments')
  if (payment.user_id) revalidatePath(`/admin/members/${payment.user_id}`)
  if (provisionNote) {
    return {
      ok: false,
      error: `Payment confirmed, but provisioning hit a problem:${provisionNote}`,
    }
  }
  return { ok: true }
}
