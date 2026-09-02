'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  applyCreditToPayment,
  getCreditBalanceCents,
} from '@/lib/credits/balance'
import {
  validateDiscountCode,
  codeFailureMessage,
  applyPercentOff,
} from '@/lib/discounts/codes'

// =====================================================================
// Manually record a payment that happened outside the app — cash at the
// front desk, a Wam POS card tap, a bank transfer, etc. The admin picks
// what was bought; we create the payment row, auto-grant the product
// (pass or subscription), and link them so refunds/audits trace back.
// =====================================================================

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

const productSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pass'),
    passId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('subscription'),
    planId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('one_time'),
    description: z.string().min(1).max(200),
  }),
])

const formSchema = z.object({
  userId: z.string().uuid(),
  amountCents: z
    .string()
    .regex(/^\d+$/, 'Amount must be a whole number of cents'),
  paymentMethod: z.enum(['cash', 'wam_pos', 'bank_transfer', 'other']),
  discountCode: z.string().trim().max(60).optional(),
  externalRef: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
  product: productSchema,
  paidAt: z.string().optional(), // ISO; defaults to now
  // Default true on the client. Walk-ins paying at the front desk are
  // physically there; we log the visit so they appear in the live feed
  // and 'Currently here' count. Admin can untick for non-on-site cases.
  checkInNow: z.boolean().optional().default(true),
  // When true, deduct from the member's TTD credit balance before
  // recording the payment. `amountCents` is treated as the gross
  // product cost; the recorded payment row reflects what was actually
  // collected in cash/transfer after applying credit.
  applyCredit: z.boolean().optional().default(false),
})

export type ManualPaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: string }

export async function recordManualPayment(
  input: z.infer<typeof formSchema>
): Promise<ManualPaymentResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = formSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  let grossCents = Number.parseInt(data.amountCents, 10)
  if (!Number.isFinite(grossCents) || grossCents < 0) {
    return { ok: false, error: 'Invalid amount' }
  }

  // Discount code: applies to the gross product cost before credit.
  let appliedCode: { codeId: string; code: string; percentOff: number } | null =
    null
  if (data.discountCode) {
    if (data.product.kind === 'one_time') {
      return {
        ok: false,
        error: 'Discount codes apply to plans and passes only.',
      }
    }
    const validation = await validateDiscountCode(admin, {
      code: data.discountCode,
      userId: data.userId,
      kind: data.product.kind === 'subscription' ? 'plan' : 'pass',
      productId:
        data.product.kind === 'subscription'
          ? data.product.planId
          : data.product.passId,
    })
    if (!validation.ok) {
      return { ok: false, error: codeFailureMessage(validation.reason) }
    }
    appliedCode = validation
    grossCents = applyPercentOff(grossCents, validation.percentOff)
  }

  // Apply credit *before* recording the payment so the row's amount_cents
  // reflects what was actually collected from the member. The applied
  // portion is written to credit_ledger and linked to the payment id.
  let creditAppliedCents = 0
  if (data.applyCredit && grossCents > 0) {
    const balance = await getCreditBalanceCents(admin, data.userId)
    creditAppliedCents = Math.min(balance, grossCents)
  }
  const amountCents = grossCents - creditAppliedCents
  const paidAt = data.paidAt
    ? new Date(data.paidAt).toISOString()
    : new Date().toISOString()

  // Idempotency: if an external_ref was supplied (Wam POS auth code,
  // for example) and we've already recorded it, no-op.
  if (data.externalRef) {
    const { data: existing } = await admin
      .from('payments')
      .select('id')
      .eq('external_ref', data.externalRef)
      .maybeSingle()
    if (existing) {
      return {
        ok: false,
        error: `This reference is already recorded as payment ${(existing as { id: string }).id}.`,
      }
    }
  }

  // Duplicate-submission guard: the same product for the same member at
  // the same gross amount within a couple of minutes is almost always a
  // double-click or an error-page retry, not two real sales. Refuse and
  // point at the original row instead of double-charging the books.
  const productKey =
    data.product.kind === 'pass'
      ? data.product.passId
      : data.product.kind === 'subscription'
        ? data.product.planId
        : data.product.description
  const { data: recentRows } = await admin
    .from('payments')
    .select('id, metadata')
    .eq('user_id', data.userId)
    .eq('kind', data.product.kind)
    .eq('status', 'succeeded')
    .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
  const duplicate = (
    (recentRows as
      | { id: string; metadata: Record<string, unknown> | null }[]
      | null) ?? []
  ).find((r) => {
    const m = r.metadata ?? {}
    if (m.manual !== true) return false
    const key = (m.passId ?? m.planId ?? m.description) as string | undefined
    return key === productKey && m.grossCents === grossCents
  })
  if (duplicate) {
    return {
      ok: false,
      error: `This looks like a duplicate — an identical ${data.product.kind} payment was recorded moments ago (${duplicate.id}). If you really do need to record it twice, wait two minutes and try again.`,
    }
  }

  // Resolve the product up front so a missing pass/plan or a plan
  // conflict fails BEFORE the payment row is written. Recording money
  // and then erroring is how duplicate payments get created.
  let passInfo: { usesTotal: number; validityDays: number } | null = null
  let subGrant: SubscriptionGrant | null = null
  if (data.product.kind === 'pass') {
    const { data: pass } = await admin
      .from('passes')
      .select('uses_total, validity_days')
      .eq('id', data.product.passId)
      .maybeSingle()
    if (!pass) {
      return { ok: false, error: `Pass "${data.product.passId}" not found` }
    }
    const p = pass as { uses_total: number; validity_days: number }
    passInfo = { usesTotal: p.uses_total, validityDays: p.validity_days }
  } else if (data.product.kind === 'subscription') {
    const resolved = await resolveSubscriptionGrant(admin, {
      userId: data.userId,
      planId: data.product.planId,
    })
    if (!resolved.ok) return { ok: false, error: resolved.error }
    subGrant = resolved.grant
  }

  // Build the metadata blob with everything useful for an audit later.
  const metadata: Record<string, unknown> = {
    manual: true,
    note: data.note ?? null,
    grossCents,
    creditAppliedCents,
    ...(appliedCode && {
      discountCode: appliedCode.code,
      discountCodeId: appliedCode.codeId,
      discountPercent: appliedCode.percentOff,
    }),
  }
  if (data.product.kind === 'pass') metadata.passId = data.product.passId
  if (data.product.kind === 'subscription') {
    metadata.planId = data.product.planId
  }
  if (data.product.kind === 'one_time') {
    metadata.description = data.product.description
  }

  const { data: paymentRow, error: payErr } = await admin
    .from('payments')
    .insert({
      user_id: data.userId,
      amount_cents: amountCents,
      currency: 'TTD',
      status: 'succeeded',
      kind: data.product.kind,
      payment_method: data.paymentMethod,
      external_ref: data.externalRef ?? null,
      recorded_by: auth.adminId,
      paid_at: paidAt,
      metadata,
    })
    .select('id')
    .single()
  if (payErr || !paymentRow) {
    console.error('[admin/payments/new] insert failed:', payErr)
    return { ok: false, error: 'Could not record payment' }
  }
  const paymentId = (paymentRow as { id: string }).id

  // Write the credit debit now that we have a payment_id to link to.
  if (creditAppliedCents > 0) {
    const apply = await applyCreditToPayment(admin, {
      userId: data.userId,
      paymentId,
      requestedCents: creditAppliedCents,
      reason:
        data.product.kind === 'one_time'
          ? `Applied to ${data.product.description}`
          : `Applied to ${data.product.kind}`,
    })
    if (!apply.ok) {
      // Soft-fail: payment is already recorded. Surface in logs so admin
      // can manually correct the ledger if it happens.
      console.warn(
        '[admin/payments/new] credit debit failed (payment already recorded):',
        apply.error
      )
    }
  }

  // Auto-provision the product, mirroring the Wam webhook behavior.
  // Track the just-granted pass id so we can deduct one use if we
  // also check the member in (walk-in flow).
  let grantedPassPurchaseId: string | null = null
  if (data.product.kind === 'pass' && passInfo) {
    const grant = await grantPass(admin, {
      userId: data.userId,
      passId: data.product.passId,
      usesTotal: passInfo.usesTotal,
      validityDays: passInfo.validityDays,
    })
    if (!grant.ok) {
      console.error('[admin/payments/new] pass grant failed:', grant.error)
      return {
        ok: false,
        error: `Payment recorded but pass grant failed: ${grant.error}`,
      }
    }
    grantedPassPurchaseId = grant.passPurchaseId ?? null
  } else if (data.product.kind === 'subscription' && subGrant) {
    const sub = await applySubscriptionGrant(admin, {
      userId: data.userId,
      planId: data.product.planId,
      grant: subGrant,
    })
    if (!sub.ok) {
      console.error(
        '[admin/payments/new] subscription grant failed:',
        sub.error
      )
      return {
        ok: false,
        error: `Payment recorded but subscription grant failed: ${sub.error}`,
      }
    }
  }

  // Optional check-in. Default true from the form. Logs a member visit
  // so the live feed + 'Currently here' tile reflect the walk-in. If
  // we just granted a single-use pass, deduct one use so the member
  // doesn't have a free unused pass + a check-in.
  if (data.checkInNow !== false) {
    let passPurchaseIdForVisit: string | null = grantedPassPurchaseId
    // For subscription grants we don't deduct anything; the visit is
    // still logged but pass_purchase_id stays null.
    if (data.product.kind === 'subscription') passPurchaseIdForVisit = null

    if (grantedPassPurchaseId) {
      const { data: passRow } = await admin
        .from('pass_purchases')
        .select('uses_remaining')
        .eq('id', grantedPassPurchaseId)
        .maybeSingle()
      const usesRemaining =
        (passRow as { uses_remaining?: number } | null)?.uses_remaining ?? 0
      if (usesRemaining > 0) {
        await admin
          .from('pass_purchases')
          .update({ uses_remaining: usesRemaining - 1 })
          .eq('id', grantedPassPurchaseId)
          .gt('uses_remaining', 0)
      } else {
        // Defensive: don't reference a pass with 0 uses on the visit.
        passPurchaseIdForVisit = null
      }
    }

    const { error: visitErr } = await admin.from('visits').insert({
      user_id: data.userId,
      kind: 'member',
      pass_purchase_id: passPurchaseIdForVisit,
    })
    if (visitErr) {
      // Don't fail the whole action — payment + grant already succeeded.
      // Surface the issue in logs so admin can check the live feed.
      console.warn(
        '[admin/payments/new] visit insert failed (payment + grant succeeded):',
        visitErr
      )
    }
  }

  revalidatePath('/admin/payments')
  revalidatePath(`/admin/members/${data.userId}`)
  revalidatePath('/admin')
  revalidatePath('/admin/checkin/visits')
  redirect(`/admin/payments?recorded=${paymentId}`)
}

// =====================================================================
// Provision helpers — match the shape used by /api/payments/wam-webhook.
// =====================================================================

interface GrantResult {
  ok: boolean
  error?: string
  passPurchaseId?: string
}

async function grantPass(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    userId: string
    passId: string
    usesTotal: number
    validityDays: number
  }
): Promise<GrantResult> {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + args.validityDays)

  const { data: row, error } = await admin
    .from('pass_purchases')
    .insert({
      user_id: args.userId,
      pass_id: args.passId,
      uses_total: args.usesTotal,
      uses_remaining: args.usesTotal,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()
  if (error || !row) {
    return { ok: false, error: error?.message ?? 'pass_purchase insert failed' }
  }
  return { ok: true, passPurchaseId: (row as { id: string }).id }
}

// Recording a payment against the plan a member already holds is a
// renewal, not a double-book — the common front-desk case is a monthly
// member paying cash for their next month. Only a *different* plan is a
// conflict, and that's rejected before the payment row is written.
type SubscriptionGrant =
  | { mode: 'new' }
  | { mode: 'renew'; subscriptionId: string; currentPeriodEnd: string }

async function resolveSubscriptionGrant(
  admin: ReturnType<typeof createAdminClient>,
  args: { userId: string; planId: string }
): Promise<
  { ok: true; grant: SubscriptionGrant } | { ok: false; error: string }
> {
  const { data: plan } = await admin
    .from('plans')
    .select('id')
    .eq('id', args.planId)
    .maybeSingle()
  if (!plan) return { ok: false, error: `Plan "${args.planId}" not found` }

  const { data: existingRows } = await admin
    .from('subscriptions')
    .select('id, plan_id, current_period_end')
    .eq('user_id', args.userId)
    .in('status', ['active', 'past_due', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
  const existing = (
    existingRows as
      | { id: string; plan_id: string; current_period_end: string }[]
      | null
  )?.[0]

  if (!existing) return { ok: true, grant: { mode: 'new' } }
  if (existing.plan_id === args.planId) {
    return {
      ok: true,
      grant: {
        mode: 'renew',
        subscriptionId: existing.id,
        currentPeriodEnd: existing.current_period_end,
      },
    }
  }
  return {
    ok: false,
    error: `This member already has an active "${existing.plan_id}" subscription. Pick that plan to record a renewal, or cancel it first to switch plans.`,
  }
}

async function applySubscriptionGrant(
  admin: ReturnType<typeof createAdminClient>,
  args: { userId: string; planId: string; grant: SubscriptionGrant }
): Promise<GrantResult> {
  const now = new Date()

  if (args.grant.mode === 'renew') {
    // The new paid period starts when the old one ends — or now, if it
    // already lapsed. Extending the existing row keeps one subscription
    // per member instead of stacking duplicates.
    const oldEnd = new Date(args.grant.currentPeriodEnd)
    const base = oldEnd.getTime() > now.getTime() ? oldEnd : now
    const periodEnd = new Date(base)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    const { error } = await admin
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_start: base.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq('id', args.grant.subscriptionId)
    if (error) return { ok: false, error: error.message }

    await activateVirtualOffice(
      admin,
      args.userId,
      args.planId,
      args.grant.subscriptionId
    )
    return { ok: true }
  }

  const periodEnd = new Date(now)
  // Self-serve plans we sell are monthly; bump a month even when the
  // billing_period column technically reads 'month'.
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const { data: row, error } = await admin
    .from('subscriptions')
    .insert({
      user_id: args.userId,
      plan_id: args.planId,
      status: 'active',
      started_at: now.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })
    .select('id')
    .single()
  if (error || !row) {
    return { ok: false, error: error?.message ?? 'subscription insert failed' }
  }

  await activateVirtualOffice(
    admin,
    args.userId,
    args.planId,
    (row as { id: string }).id
  )
  return { ok: true }
}

// Mirrors the Wam-webhook provision path: a VO plan grant flips the
// member's virtual_office_subscriptions row active and links it. No row
// yet is fine — the admin can create one from the member page.
async function activateVirtualOffice(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  planId: string,
  subscriptionId: string
): Promise<void> {
  if (planId !== 'virtual-office-monthly') return
  const { error } = await admin
    .from('virtual_office_subscriptions')
    .update({ is_active: true, subscription_id: subscriptionId })
    .eq('user_id', userId)
  if (error) {
    console.error(
      '[admin/payments/new] virtual office activation failed:',
      userId,
      error
    )
  }
}
