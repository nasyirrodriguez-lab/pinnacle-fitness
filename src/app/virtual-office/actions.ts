'use server'

import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getWam } from '@/lib/wam/client'
import { VO_AGREEMENT_VERSION } from '@/config/virtual-office'
import {
  hasAllRequiredDocs,
  loadLatestDocsByKind,
} from '@/lib/virtual-office/documents'

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'http://localhost:3000'
  )
}

const signupSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(200),
  intendedUse: z.string().max(2000).optional(),
  forwardingEmail: z
    .string()
    .email('Enter a valid email')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  acceptAgreement: z
    .boolean()
    .refine((v) => v === true, 'You must accept the agreement'),
})

export type SignupResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string }

export async function startVirtualOfficeSignup(
  input: z.infer<typeof signupSchema>
): Promise<SignupResult> {
  let data
  try {
    data = signupSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const admin = createAdminClient()

  // Compliance docs gate. All three required uploads must be on file (any
  // status) before we let payment start. Admin review happens after.
  const latestDocs = await loadLatestDocsByKind(admin, user.id)
  if (!hasAllRequiredDocs(latestDocs)) {
    return {
      ok: false,
      error:
        'Please upload all three required documents before continuing to payment.',
    }
  }

  // One Virtual Office per profile.
  const { data: existing } = await admin
    .from('virtual_office_subscriptions')
    .select('id, is_active')
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing && (existing as { is_active: boolean }).is_active) {
    return {
      ok: false,
      error:
        'You already have an active Virtual Office. Email team@theworx.io to make changes.',
    }
  }

  const { data: planRow } = await admin
    .from('plans')
    .select('id, name, price_cents, currency, billing_period')
    .eq('id', 'virtual-office-monthly')
    .eq('is_active', true)
    .maybeSingle()
  if (!planRow) {
    return {
      ok: false,
      error: 'Virtual Office is not currently available.',
    }
  }
  const plan = planRow as {
    id: string
    name: string
    price_cents: number
    currency: string
    billing_period: string
  }

  // Upsert the VO row as inactive — the webhook flips it to active after
  // payment succeeds.
  const { error: voErr } = await admin
    .from('virtual_office_subscriptions')
    .upsert(
      {
        user_id: user.id,
        business_name: data.businessName.trim(),
        intended_use: data.intendedUse?.trim() || null,
        forwarding_email: data.forwardingEmail || null,
        agreement_version: VO_AGREEMENT_VERSION,
        agreement_accepted_at: new Date().toISOString(),
        is_active: false,
      },
      { onConflict: 'user_id' }
    )
  if (voErr) {
    console.error('[vo/signup] upsert failed:', voErr)
    return {
      ok: false,
      error: 'Could not save your Virtual Office details.',
    }
  }

  // Create payment row + Wam intent. Mirrors /api/checkout/plan.
  const { data: paymentRow, error: paymentErr } = await admin
    .from('payments')
    .insert({
      user_id: user.id,
      amount_cents: plan.price_cents,
      currency: plan.currency,
      status: 'pending',
      kind: 'subscription',
      metadata: {
        planId: plan.id,
        billingPeriod: plan.billing_period,
        virtualOffice: true,
      },
    })
    .select('id')
    .single()
  if (paymentErr || !paymentRow) {
    console.error('[vo/signup] payment insert failed:', paymentErr)
    return { ok: false, error: 'Could not start payment' }
  }
  const paymentId = (paymentRow as { id: string }).id

  let intent
  try {
    intent = await getWam().createPaymentIntent({
      amountCents: plan.price_cents,
      currency: plan.currency,
      orderReference: `vo-${paymentId}`,
      description: `Virtual Office — ${data.businessName.trim()}`,
      returnUrl: `${getSiteUrl()}/checkout/complete?paymentId=${paymentId}`,
      metadata: {
        paymentId,
        userId: user.id,
        kind: 'subscription',
        planId: plan.id,
        billingPeriod: plan.billing_period,
        virtualOffice: 'true',
      },
    })
  } catch (err) {
    console.error('[vo/signup] wam intent failed:', err)
    await admin
      .from('payments')
      .update({ status: 'failed', failure_reason: 'wam_intent_failed' })
      .eq('id', paymentId)
    return { ok: false, error: 'Payment service unavailable' }
  }

  await admin
    .from('payments')
    .update({ wam_payment_id: intent.paymentId })
    .eq('id', paymentId)

  return { ok: true, checkoutUrl: intent.checkoutUrl }
}
