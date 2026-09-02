'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendRenewalReminder } from '@/lib/email/payment-reminder'
import { sendMemberNotification } from '@/lib/notifications/notify'
import { issueCreditGrant } from '@/lib/credits/balance'
import { effectivePrice } from '@/lib/pricing/effective'
import { getWam } from '@/lib/wam/client'
import { sendPaymentRequestEmail } from '@/lib/email/payment-request'

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
  if (!profile || (profile as { role?: string }).role !== 'admin') {
    return { error: 'Admin only' }
  }
  return { adminId: user.id }
}

const updateMemberSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(1).max(120),
  phone: z.string().max(40).optional().nullable(),
  company: z.string().max(120).optional().nullable(),
  role: z.enum(['member', 'admin']),
  designation: z.string().min(1).max(60).nullable(),
  archived: z.boolean(),
})

export type AdminActionResult = { ok: true } | { ok: false; error: string }

export async function adminUpdateMember(
  input: z.infer<typeof updateMemberSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = updateMemberSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  // Safety rail: admin can't demote themselves to member (would lock them out).
  if (data.userId === auth.adminId && data.role !== 'admin') {
    return {
      ok: false,
      error: 'You cannot remove admin from your own account.',
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      full_name: data.fullName.trim(),
      phone: data.phone?.trim() || null,
      company: data.company?.trim() || null,
      role: data.role,
      designation: data.designation,
      archived: data.archived,
    })
    .eq('id', data.userId)

  if (error) {
    console.error('[admin/updateMember] failed:', error)
    return { ok: false, error: 'Could not save changes' }
  }

  revalidatePath(`/admin/members/${data.userId}`)
  revalidatePath('/admin/members')
  return { ok: true }
}

// =====================================================================
// Pass management — admin adjustments and walk-in check-ins.
// =====================================================================

const adjustPassSchema = z.object({
  passPurchaseId: z.string().uuid(),
  deltaUses: z
    .number()
    .int()
    .refine((n) => n !== 0, 'Delta must be non-zero'),
  reason: z.string().trim().min(1).max(200),
})

export async function adminAdjustPassUses(
  input: z.infer<typeof adjustPassSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = adjustPassSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const { data: row, error: lookupErr } = await admin
    .from('pass_purchases')
    .select('id, user_id, uses_total, uses_remaining')
    .eq('id', data.passPurchaseId)
    .maybeSingle()
  if (lookupErr || !row) {
    return { ok: false, error: 'Pass not found' }
  }
  const pass = row as {
    id: string
    user_id: string
    uses_total: number
    uses_remaining: number
  }

  const newRemaining = pass.uses_remaining + data.deltaUses
  if (newRemaining < 0) {
    return {
      ok: false,
      error: `Cannot reduce below zero (currently ${pass.uses_remaining}).`,
    }
  }

  // Adding uses also raises uses_total so the badge stays sane.
  // Removing uses only drops uses_remaining; total stays as historical
  // record of what was originally granted.
  const updates: Record<string, number> = { uses_remaining: newRemaining }
  if (data.deltaUses > 0) {
    updates.uses_total = pass.uses_total + data.deltaUses
  }

  const { error: updateErr } = await admin
    .from('pass_purchases')
    .update(updates)
    .eq('id', pass.id)
  if (updateErr) {
    console.error('[admin/adjustPassUses] update failed:', updateErr)
    return { ok: false, error: 'Could not adjust pass' }
  }

  const { error: logErr } = await admin.from('pass_adjustments').insert({
    pass_purchase_id: pass.id,
    delta_uses: data.deltaUses,
    reason: data.reason,
    admin_id: auth.adminId,
  })
  if (logErr) {
    console.error('[admin/adjustPassUses] audit log insert failed:', logErr)
    // Don't roll back — the adjustment already applied. Admin can re-log
    // manually if it matters.
  }

  revalidatePath(`/admin/members/${pass.user_id}`)
  return { ok: true }
}

const checkInWithPassSchema = z.object({
  passPurchaseId: z.string().uuid(),
})

export async function adminCheckInWithPass(
  input: z.infer<typeof checkInWithPassSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = checkInWithPassSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid input' }
  }

  const admin = createAdminClient()
  const { data: row, error: lookupErr } = await admin
    .from('pass_purchases')
    .select('id, user_id, uses_remaining, expires_at')
    .eq('id', data.passPurchaseId)
    .maybeSingle()
  if (lookupErr || !row) return { ok: false, error: 'Pass not found' }
  const pass = row as {
    id: string
    user_id: string
    uses_remaining: number
    expires_at: string
  }

  if (pass.uses_remaining <= 0) {
    return { ok: false, error: 'No uses remaining on this pass.' }
  }
  if (new Date(pass.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'This pass has expired.' }
  }

  // Deduct one use — gated on uses_remaining > 0 in WHERE so concurrent
  // check-ins can't both succeed.
  const { error: deductErr, count } = await admin
    .from('pass_purchases')
    .update({ uses_remaining: pass.uses_remaining - 1 }, { count: 'exact' })
    .eq('id', pass.id)
    .gt('uses_remaining', 0)
  if (deductErr || (count ?? 0) === 0) {
    return { ok: false, error: 'Pass was already used elsewhere — refresh.' }
  }

  await admin.from('pass_adjustments').insert({
    pass_purchase_id: pass.id,
    delta_uses: -1,
    reason: 'admin check-in',
    admin_id: auth.adminId,
  })

  const { error: visitErr } = await admin.from('visits').insert({
    user_id: pass.user_id,
    kind: 'member',
    pass_purchase_id: pass.id,
  })
  if (visitErr) {
    console.warn(
      '[admin/checkInWithPass] visit insert failed (use already deducted):',
      visitErr
    )
  }

  revalidatePath(`/admin/members/${pass.user_id}`)
  revalidatePath('/admin/checkin/visits')
  revalidatePath('/admin')
  return { ok: true }
}

const addNoteSchema = z.object({
  userId: z.string().uuid(),
  body: z.string().min(1).max(5000),
})

export async function adminAddNote(
  input: z.infer<typeof addNoteSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = addNoteSchema.parse(input)
  } catch {
    return { ok: false, error: 'Note is required' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('admin_notes').insert({
    user_id: data.userId,
    author_id: auth.adminId,
    body: data.body.trim(),
  })

  if (error) {
    console.error('[admin/addNote] failed:', error)
    return { ok: false, error: 'Could not save note' }
  }

  revalidatePath(`/admin/members/${data.userId}`)
  return { ok: true }
}

// =====================================================================
// Membership controls — pause, cancel, reactivate. Reactivating a
// lapsed membership comps a fresh month from today; record a payment
// instead when the member is actually paying for the renewal.
// =====================================================================

const subControlSchema = z.object({
  userId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  action: z.enum(['pause', 'cancel', 'reactivate', 'extend']),
})

export async function adminControlSubscription(
  input: z.infer<typeof subControlSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = subControlSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid input' }
  }

  const admin = createAdminClient()
  const { data: subRow } = await admin
    .from('subscriptions')
    .select('id, status, current_period_end')
    .eq('id', data.subscriptionId)
    .eq('user_id', data.userId)
    .maybeSingle()
  if (!subRow) return { ok: false, error: 'Subscription not found' }
  const sub = subRow as {
    id: string
    status: string
    current_period_end: string
  }

  const update: Record<string, unknown> = {}
  if (data.action === 'pause') {
    if (sub.status !== 'active' && sub.status !== 'past_due') {
      return { ok: false, error: `Cannot pause a ${sub.status} membership` }
    }
    update.status = 'paused'
  } else if (data.action === 'cancel') {
    // NB: the subscriptions_status_check constraint spells it 'cancelled'.
    update.status = 'cancelled'
  } else if (data.action === 'extend') {
    // Admin-side renewal — the only renewal path for private plans. The
    // new month starts when the old one ends, or now if it lapsed.
    const oldEnd = new Date(sub.current_period_end)
    const base = oldEnd.getTime() > Date.now() ? oldEnd : new Date()
    const periodEnd = new Date(base)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    update.status = 'active'
    update.current_period_start = base.toISOString()
    update.current_period_end = periodEnd.toISOString()
  } else {
    update.status = 'active'
    if (new Date(sub.current_period_end).getTime() < Date.now()) {
      const now = new Date()
      const periodEnd = new Date(now)
      periodEnd.setMonth(periodEnd.getMonth() + 1)
      update.current_period_start = now.toISOString()
      update.current_period_end = periodEnd.toISOString()
    }
  }

  const { error } = await admin
    .from('subscriptions')
    .update(update)
    .eq('id', data.subscriptionId)
  if (error) {
    console.error('[admin/controlSubscription] failed:', error)
    return { ok: false, error: 'Could not update membership' }
  }

  const actionLabel = {
    pause: 'paused',
    cancel: 'cancelled',
    reactivate: 'reactivated',
    extend: 'renewed (extended a month)',
  }[data.action]
  await admin.from('admin_notes').insert({
    user_id: data.userId,
    author_id: auth.adminId,
    body: `Admin ${actionLabel} membership ${data.subscriptionId}.`,
  })

  // A VO membership going inactive should reflect on the VO record too.
  if (data.action === 'cancel' || data.action === 'pause') {
    await admin
      .from('virtual_office_subscriptions')
      .update({ is_active: false })
      .eq('subscription_id', data.subscriptionId)
  } else {
    await admin
      .from('virtual_office_subscriptions')
      .update({ is_active: true })
      .eq('subscription_id', data.subscriptionId)
  }

  revalidatePath(`/admin/members/${data.userId}`)
  revalidatePath('/admin/members')
  revalidatePath('/admin/virtual-office')
  return { ok: true }
}

const renewalReminderSchema = z.object({ userId: z.string().uuid() })

export async function adminSendRenewalReminder(input: {
  userId: string
}): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let userId
  try {
    userId = renewalReminderSchema.parse({ userId: input.userId }).userId
  } catch {
    return { ok: false, error: 'Invalid member' }
  }

  const admin = createAdminClient()
  const [{ data: profileRow }, { data: subRows }] = await Promise.all([
    admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle(),
    admin
      .from('subscriptions')
      .select('id, plan_id, current_period_end, plans(name, price_cents)')
      .eq('user_id', userId)
      .in('status', ['active', 'past_due', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1),
  ])
  if (!profileRow) return { ok: false, error: 'Member not found' }
  const sub = (
    subRows as
      | {
          id: string
          plan_id: string
          current_period_end: string
          plans:
            | { name?: string; price_cents?: number }
            | { name?: string; price_cents?: number }[]
            | null
        }[]
      | null
  )?.[0]
  if (!sub) return { ok: false, error: 'No membership to remind about' }

  const profile = profileRow as { email: string; full_name: string | null }
  const planRaw = sub.plans
  const plan = Array.isArray(planRaw) ? (planRaw[0] ?? null) : planRaw
  const planName = plan?.name ?? sub.plan_id
  const firstName = (profile.full_name ?? '').trim().split(/\s+/)[0] || null

  const sent = await sendRenewalReminder({
    to: profile.email,
    firstName,
    planName,
    periodEndIso: sub.current_period_end,
    priceCents: plan?.price_cents ?? null,
  })
  if (!sent) return { ok: false, error: 'Email could not be sent — try again' }

  await sendMemberNotification(admin, {
    userId,
    title: `Your ${planName} membership — renewal reminder`,
    body: 'Your membership is due for renewal. Settle at the front desk (cash or card) or from your dashboard, and everything keeps rolling.',
    createdBy: auth.adminId,
  })

  return { ok: true }
}

// =====================================================================
// Room-hour credits + direct account credit — issued right from the
// member page, no email round-trip.
// =====================================================================

const grantRoomHoursSchema = z.object({
  userId: z.string().uuid(),
  resourceId: z.string().min(1).max(60),
  hours: z.number().min(0.5).max(500),
  reason: z.string().trim().max(200).optional(),
  expiresAt: z
    .string()
    .max(40)
    .nullable()
    .optional()
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), {
      message: 'Invalid expiry date',
    }),
})

export async function adminGrantRoomHours(
  input: z.infer<typeof grantRoomHoursSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = grantRoomHoursSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('room_hour_credits').insert({
    user_id: data.userId,
    resource_id: data.resourceId,
    hours_granted: data.hours,
    reason: data.reason?.trim() || null,
    expires_at: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
    granted_by: auth.adminId,
  })
  if (error) {
    console.error('[admin/grantRoomHours] failed:', error)
    return { ok: false, error: 'Could not grant hours' }
  }

  revalidatePath(`/admin/members/${data.userId}`)
  return { ok: true }
}

export async function adminRevokeRoomHours(input: {
  userId: string
  creditId: string
}): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (
    !z.string().uuid().safeParse(input.creditId).success ||
    !z.string().uuid().safeParse(input.userId).success
  ) {
    return { ok: false, error: 'Invalid input' }
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('room_hour_credits')
    .select('id, hours_used')
    .eq('id', input.creditId)
    .eq('user_id', input.userId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Credit not found' }

  const used = Number((row as { hours_used: number }).hours_used)
  // Untouched grants disappear; partly-used ones shrink to what was used
  // so the history stays truthful.
  const { error } =
    used <= 0
      ? await admin.from('room_hour_credits').delete().eq('id', input.creditId)
      : await admin
          .from('room_hour_credits')
          .update({ hours_granted: used })
          .eq('id', input.creditId)
  if (error) {
    console.error('[admin/revokeRoomHours] failed:', error)
    return { ok: false, error: 'Could not revoke' }
  }

  revalidatePath(`/admin/members/${input.userId}`)
  return { ok: true }
}

const directCreditSchema = z.object({
  userId: z.string().uuid(),
  amountCents: z.number().int().min(1).max(10_000_000),
  note: z.string().trim().max(300).optional(),
})

export async function adminIssueCreditDirect(
  input: z.infer<typeof directCreditSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = directCreditSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  const result = await issueCreditGrant(admin, {
    userId: data.userId,
    recipientEmail: null,
    amountCents: data.amountCents,
    reason: 'other',
    reasonNote: data.note?.trim() || 'Issued from member page',
    expiresAt,
    issuedBy: auth.adminId,
  })
  if (!result.ok) {
    return { ok: false, error: result.error ?? 'Could not issue credit' }
  }

  revalidatePath(`/admin/members/${data.userId}`)
  return { ok: true }
}

// =====================================================================
// Add-ons — recurring extras (locker, signage, extra desk…) attached to
// a specific member and charged alongside their plan.
// =====================================================================

const addonSchema = z.object({
  userId: z.string().uuid(),
  label: z.string().trim().min(1, 'Name the add-on').max(120),
  amountCents: z.number().int().min(0).max(10_000_000),
  // Optional fixed duration — the add-on ends by itself after this.
  periodAmount: z.number().min(0.5).max(10_000).nullable().optional(),
  periodUnit: z
    .enum(['minutes', 'hours', 'days', 'months'])
    .nullable()
    .optional(),
})

function addonExpiryIso(
  amount: number | null | undefined,
  unit: string | null | undefined
): string | null {
  if (!amount || !unit) return null
  const end = new Date()
  switch (unit) {
    case 'minutes':
      end.setTime(end.getTime() + amount * 60 * 1000)
      break
    case 'hours':
      end.setTime(end.getTime() + amount * 60 * 60 * 1000)
      break
    case 'days':
      end.setTime(end.getTime() + amount * 24 * 60 * 60 * 1000)
      break
    case 'months':
      end.setMonth(end.getMonth() + Math.round(amount))
      break
    default:
      return null
  }
  return end.toISOString()
}

export async function adminAddMemberAddon(
  input: z.infer<typeof addonSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = addonSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('member_addons').insert({
    user_id: data.userId,
    label: data.label,
    amount_cents: data.amountCents,
    expires_at: addonExpiryIso(data.periodAmount, data.periodUnit),
    created_by: auth.adminId,
  })
  if (error) {
    console.error('[admin/addAddon] failed:', error)
    return { ok: false, error: 'Could not add the add-on' }
  }
  revalidatePath(`/admin/members/${data.userId}`)
  return { ok: true }
}

export async function adminRemoveMemberAddon(input: {
  userId: string
  addonId: string
}): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (
    !z.string().uuid().safeParse(input.addonId).success ||
    !z.string().uuid().safeParse(input.userId).success
  ) {
    return { ok: false, error: 'Invalid input' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('member_addons')
    .delete()
    .eq('id', input.addonId)
    .eq('user_id', input.userId)
  if (error) return { ok: false, error: 'Could not remove the add-on' }
  revalidatePath(`/admin/members/${input.userId}`)
  return { ok: true }
}

// =====================================================================
// Payment requests — assign a plan/pass and ask the member to pay.
// Nothing activates until the payment succeeds: the pending payment
// carries the product in metadata and the Wam webhook / reconcile cron
// provisions it the moment it's paid, same as self-serve checkout.
// =====================================================================

const requestPaymentSchema = z.object({
  userId: z.string().uuid(),
  kind: z.enum(['plan', 'pass']),
  productId: z.string().min(1).max(60),
  includeAddons: z.boolean().default(false),
})

export type RequestPaymentResult =
  | { ok: true; amountCents: number }
  | { ok: false; error: string }

export async function adminRequestPayment(
  input: z.infer<typeof requestPaymentSchema>
): Promise<RequestPaymentResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = requestPaymentSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid input' }
  }

  const admin = createAdminClient()
  const table = data.kind === 'plan' ? 'plans' : 'passes'
  const [{ data: productRow }, { data: profileRow }, { data: addonRows }] =
    await Promise.all([
      admin
        .from(table)
        .select(
          'id, name, price_cents, discounted_price_cents, discount_expires_at, currency'
        )
        .eq('id', data.productId)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('email, full_name')
        .eq('id', data.userId)
        .maybeSingle(),
      admin
        .from('member_addons')
        .select('amount_cents')
        .eq('user_id', data.userId)
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
    ])
  if (!productRow) return { ok: false, error: 'Product not found' }
  if (!profileRow) return { ok: false, error: 'Member not found' }

  const product = productRow as {
    id: string
    name: string
    price_cents: number
    discounted_price_cents: number | null
    discount_expires_at: string | null
    currency: string
  }
  const profile = profileRow as { email: string; full_name: string | null }

  const baseCents = effectivePrice(product).effectiveCents
  const addonsCents =
    data.kind === 'plan' && data.includeAddons
      ? ((addonRows as { amount_cents: number }[] | null) ?? []).reduce(
          (sum, a) => sum + a.amount_cents,
          0
        )
      : 0
  const amountCents = baseCents + addonsCents
  if (amountCents <= 0) {
    return {
      ok: false,
      error: 'This product is free — grant it via Record Payment instead.',
    }
  }

  const metadata: Record<string, unknown> = {
    requested: true,
    requestedBy: auth.adminId,
    addonsCents,
  }
  if (data.kind === 'plan') {
    metadata.planId = product.id
    metadata.billingPeriod = 'month'
    if (product.id === 'virtual-office-monthly') metadata.virtualOffice = true
  } else {
    metadata.passId = product.id
  }

  const { data: paymentRow, error: payErr } = await admin
    .from('payments')
    .insert({
      user_id: data.userId,
      amount_cents: amountCents,
      currency: product.currency,
      status: 'pending',
      kind: data.kind === 'plan' ? 'subscription' : 'pass',
      payment_method: 'wam_online',
      metadata,
    })
    .select('id')
    .single()
  if (payErr || !paymentRow) {
    console.error('[admin/requestPayment] payment insert failed:', payErr)
    return { ok: false, error: 'Could not create the payment request' }
  }
  const paymentId = (paymentRow as { id: string }).id

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://theworx.io'
  let intent
  try {
    intent = await getWam().createPaymentIntent({
      amountCents,
      currency: product.currency,
      orderReference: `request-${paymentId}`,
      description: `${product.name} — requested by The Worx`,
      returnUrl: `${siteUrl}/checkout/complete?paymentId=${paymentId}`,
      metadata: {
        paymentId,
        userId: data.userId,
        kind: data.kind === 'plan' ? 'subscription' : 'pass',
      },
    })
  } catch (err) {
    console.error('[admin/requestPayment] wam intent failed:', err)
    await admin.from('payments').delete().eq('id', paymentId)
    return { ok: false, error: 'Payment service unavailable — try again' }
  }

  await admin
    .from('payments')
    .update({ wam_payment_id: intent.paymentId })
    .eq('id', paymentId)

  const firstName = (profile.full_name ?? '').trim().split(/\s+/)[0] || null
  await sendPaymentRequestEmail({
    to: profile.email,
    firstName,
    productName: product.name,
    amountCents,
    payUrl: intent.checkoutUrl,
  })
  await sendMemberNotification(admin, {
    userId: data.userId,
    title: `Payment requested — ${product.name}`,
    body: `The Worx team set you up with ${product.name} (TTD $${(amountCents / 100).toFixed(0)}${addonsCents > 0 ? ', add-ons included' : ''}). It activates as soon as you pay — check your email for the payment link.`,
    createdBy: auth.adminId,
  })

  revalidatePath(`/admin/members/${data.userId}`)
  revalidatePath('/admin/payments')
  return { ok: true, amountCents }
}

// =====================================================================
// Edit / cancel an outstanding payment request (a pending wam_online
// payment). Editing re-prices it and issues a fresh Wam pay link;
// cancelling withdraws it so the old link can't activate anything.
// =====================================================================

const cancelRequestSchema = z.object({
  paymentId: z.string().uuid(),
})

export async function adminCancelPaymentRequest(
  input: z.infer<typeof cancelRequestSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = cancelRequestSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid request' }
  }

  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from('payments')
    .update({
      status: 'cancelled',
      failure_reason: 'request cancelled by admin',
    })
    .eq('id', data.paymentId)
    .eq('status', 'pending')
    .select('user_id, amount_cents')
    .maybeSingle()
  if (error || !updated) {
    return { ok: false, error: 'Request not found or already settled' }
  }

  const userId = (updated as { user_id: string | null }).user_id
  if (userId) {
    await admin.from('admin_notes').insert({
      user_id: userId,
      author_id: auth.adminId,
      body: `Cancelled payment request ${data.paymentId} (TTD $${(((updated as { amount_cents: number }).amount_cents ?? 0) / 100).toFixed(0)}).`,
    })
    revalidatePath(`/admin/members/${userId}`)
  }
  revalidatePath('/admin/payments')
  return { ok: true }
}

const editRequestSchema = z.object({
  paymentId: z.string().uuid(),
  amountCents: z.number().int().min(100).max(10_000_000),
})

export async function adminEditPaymentRequest(
  input: z.infer<typeof editRequestSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = editRequestSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid amount' }
  }

  const admin = createAdminClient()
  const { data: paymentRaw } = await admin
    .from('payments')
    .select('id, user_id, status, currency, metadata, kind')
    .eq('id', data.paymentId)
    .maybeSingle()
  if (!paymentRaw) return { ok: false, error: 'Request not found' }
  const payment = paymentRaw as {
    id: string
    user_id: string | null
    status: string
    currency: string
    metadata: Record<string, unknown> | null
    kind: string
  }
  if (payment.status !== 'pending') {
    return { ok: false, error: `Request is already ${payment.status}` }
  }
  if (!payment.user_id) return { ok: false, error: 'No member on this request' }

  const { data: profileRow } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', payment.user_id)
    .maybeSingle()
  if (!profileRow) return { ok: false, error: 'Member not found' }
  const profile = profileRow as { email: string; full_name: string | null }

  const metadata = payment.metadata ?? {}
  const productName =
    typeof metadata.planId === 'string'
      ? metadata.planId
      : typeof metadata.passId === 'string'
        ? metadata.passId
        : 'your membership'

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://theworx.io'
  let intent
  try {
    intent = await getWam().createPaymentIntent({
      amountCents: data.amountCents,
      currency: payment.currency || 'TTD',
      orderReference: `request-${payment.id}-${Date.now()}`,
      description: `Updated payment request — The Worx`,
      returnUrl: `${siteUrl}/checkout/complete?paymentId=${payment.id}`,
      metadata: {
        paymentId: payment.id,
        userId: payment.user_id,
        kind: payment.kind,
      },
    })
  } catch (err) {
    console.error('[admin/editRequest] wam intent failed:', err)
    return { ok: false, error: 'Payment service unavailable — try again' }
  }

  const { error: updErr } = await admin
    .from('payments')
    .update({
      amount_cents: data.amountCents,
      wam_payment_id: intent.paymentId,
      metadata: { ...metadata, editedBy: auth.adminId },
    })
    .eq('id', payment.id)
    .eq('status', 'pending')
  if (updErr) {
    return { ok: false, error: 'Could not update the request' }
  }

  const firstName = (profile.full_name ?? '').trim().split(/\s+/)[0] || null
  await sendPaymentRequestEmail({
    to: profile.email,
    firstName,
    productName,
    amountCents: data.amountCents,
    payUrl: intent.checkoutUrl,
  })
  await sendMemberNotification(admin, {
    userId: payment.user_id,
    title: `Payment request updated — TTD $${(data.amountCents / 100).toFixed(0)}`,
    body: `The Worx team updated your payment request. The new amount is TTD $${(data.amountCents / 100).toFixed(0)} — use the fresh payment link in your email.`,
    createdBy: auth.adminId,
  })
  await admin.from('admin_notes').insert({
    user_id: payment.user_id,
    author_id: auth.adminId,
    body: `Edited payment request ${payment.id} to TTD $${(data.amountCents / 100).toFixed(0)} and re-sent the pay link.`,
  })

  revalidatePath(`/admin/members/${payment.user_id}`)
  revalidatePath('/admin/payments')
  return { ok: true }
}
