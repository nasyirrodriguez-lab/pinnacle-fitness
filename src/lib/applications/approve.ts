import type { SupabaseClient } from '@supabase/supabase-js'
import { getWam } from '@/lib/wam/client'
import { effectivePrice } from '@/lib/pricing/effective'
import { sendInviteEmail } from '@/lib/applications/emails'
import { sendMemberNotification } from '@/lib/notifications/notify'
import { CONTACT } from '@/config/location'

// Approving an applicant is the moment they become a member-in-waiting:
// an account exists, a welcome email with a pay link goes out, and the
// membership goes live only when the money confirms through the normal
// payment pipeline. The pay link has a shelf life; if it lapses the
// spot goes back to the waitlist (housekeeping cron).

export interface ApplicationRow {
  id: string
  full_name: string
  email: string
  phone: string | null
  experience_bracket: string | null
  training_now: string | null
  goal: string | null
  referred_by: string | null
  plan_interest: string | null
  status: string
}

export type ApproveResult =
  | { ok: true; userId: string; paymentId: string | null }
  | { ok: false; error: string }

const INVITE_DAYS = 7

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? CONTACT.siteUrl
}

// Find-or-create the auth user. The auth trigger creates the profile row.
async function ensureAccount(
  admin: SupabaseClient,
  app: ApplicationRow
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const email = app.email.toLowerCase().trim()
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (existing) return { ok: true, userId: (existing as { id: string }).id }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: app.full_name },
  })
  if (error || !data.user) {
    console.error('[applications] createUser failed:', error)
    return { ok: false, error: 'Could not create the member account' }
  }
  // Give the trigger a beat, then make sure the profile is there either way.
  const userId = data.user.id
  await admin
    .from('profiles')
    .upsert({ id: userId, email }, { onConflict: 'id', ignoreDuplicates: true })
  return { ok: true, userId }
}

export async function approveApplication(
  admin: SupabaseClient,
  args: {
    application: ApplicationRow
    adminId: string
    planId: string | null
    fromWaitlist?: boolean
  }
): Promise<ApproveResult> {
  const app = args.application
  const account = await ensureAccount(admin, app)
  if (!account.ok) return account
  const userId = account.userId

  await admin
    .from('profiles')
    .update({
      full_name: app.full_name,
      phone: app.phone,
      role: 'member',
      experience_bracket: app.experience_bracket,
      applied_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      approved_by: args.adminId,
      goal: app.goal,
      archived: false,
    })
    .eq('id', userId)

  // Optional pay link for the plan they asked for.
  let paymentId: string | null = null
  let payUrl: string | null = null
  let planName: string | null = null
  let amountCents: number | null = null
  const planId = args.planId ?? app.plan_interest
  if (planId) {
    const { data: planRow } = await admin
      .from('plans')
      .select(
        'id, name, price_cents, discounted_price_cents, discount_expires_at, currency, is_active'
      )
      .eq('id', planId)
      .maybeSingle()
    const plan = planRow as {
      id: string
      name: string
      price_cents: number
      discounted_price_cents: number | null
      discount_expires_at: string | null
      currency: string
      is_active: boolean
    } | null
    if (plan && plan.is_active) {
      planName = plan.name
      amountCents = effectivePrice(plan).effectiveCents
      const { data: paymentRow } = await admin
        .from('payments')
        .insert({
          user_id: userId,
          amount_cents: amountCents,
          currency: plan.currency,
          status: 'pending',
          kind: 'subscription',
          payment_method: 'wam_online',
          metadata: {
            planId: plan.id,
            billingPeriod: 'month',
            requested: true,
            requestedBy: args.adminId,
            applicationId: app.id,
          },
        })
        .select('id')
        .single()
      if (paymentRow) {
        paymentId = (paymentRow as { id: string }).id
        try {
          const intent = await getWam().createPaymentIntent({
            amountCents,
            currency: plan.currency,
            orderReference: `apply-${paymentId}`,
            description: `${plan.name} — Pinnacle Fitness`,
            returnUrl: `${siteUrl()}/checkout/complete?paymentId=${paymentId}`,
            metadata: {
              paymentId,
              userId,
              kind: 'subscription',
              planId: plan.id,
            },
          })
          payUrl = intent.checkoutUrl
          await admin
            .from('payments')
            .update({ wam_payment_id: intent.paymentId })
            .eq('id', paymentId)
        } catch (err) {
          console.error('[applications] wam intent failed:', err)
          await admin.from('payments').delete().eq('id', paymentId)
          paymentId = null
          payUrl = null
        }
      }
    }
  }

  const expiresAt = new Date(
    Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
  await admin
    .from('applications')
    .update({
      status: args.fromWaitlist ? 'invited' : 'approved',
      approved_user_id: userId,
      invited_at: new Date().toISOString(),
      invite_expires_at: expiresAt,
      invite_payment_id: paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', app.id)

  await sendInviteEmail({
    to: app.email,
    fullName: app.full_name,
    planName,
    amountCents,
    payUrl,
    expiresAt,
    signInUrl: `${siteUrl()}/sign-in`,
  })
  await sendMemberNotification(admin, {
    userId,
    title: 'Welcome to Pinnacle',
    body: planName
      ? `You're approved. Pay for ${planName} from the email we sent and your membership goes live the moment it confirms. Then set your PIN and book your first session.`
      : "You're approved. Pick a plan under Plan, then set your PIN and book your first session.",
    createdBy: args.adminId,
  })

  return { ok: true, userId, paymentId }
}

// Invites that lapsed: cancel the pending payment and put them back on
// the waitlist so the spot can go to the next person.
export async function expireLapsedInvites(
  admin: SupabaseClient
): Promise<number> {
  const nowIso = new Date().toISOString()
  const { data } = await admin
    .from('applications')
    .select('id, invite_payment_id')
    .eq('status', 'invited')
    .lt('invite_expires_at', nowIso)
  let expired = 0
  for (const row of (data as
    | { id: string; invite_payment_id: string | null }[]
    | null) ?? []) {
    if (row.invite_payment_id) {
      const { data: pay } = await admin
        .from('payments')
        .select('status')
        .eq('id', row.invite_payment_id)
        .maybeSingle()
      if ((pay as { status: string } | null)?.status === 'succeeded') {
        await admin
          .from('applications')
          .update({ status: 'approved', updated_at: nowIso })
          .eq('id', row.id)
        continue
      }
      await admin
        .from('payments')
        .update({ status: 'cancelled', failure_reason: 'invite expired' })
        .eq('id', row.invite_payment_id)
        .eq('status', 'pending')
    }
    await admin
      .from('applications')
      .update({
        status: 'waitlisted',
        invite_payment_id: null,
        updated_at: nowIso,
      })
      .eq('id', row.id)
    expired++
  }
  return expired
}
