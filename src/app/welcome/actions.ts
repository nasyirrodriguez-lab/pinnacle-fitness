'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { CURRENT_TERMS_VERSION } from '@/config/terms'
import { grantExplorePass } from '@/lib/passes/grant-explore'
import { sendWelcomeEmail } from '@/lib/email/welcome'
import { attributeReferral } from '@/lib/referrals/attribute'
import { clearReferralCookie, readReferralCookie } from '@/lib/referrals/cookie'

const onboardingSchema = z.object({
  fullName: z.string().min(1, 'Your name is required').max(120),
  phone: z
    .string()
    .trim()
    .min(7, 'A contact number is required')
    .max(40)
    .regex(/^\+?[\d\s\-()]{7,}$/, 'Enter a valid phone number'),
  acceptTerms: z.literal(true, {
    message: 'You must accept the Terms and Conditions to continue',
  }),
  next: z.string().optional(),
})

export type OnboardingResult =
  | { ok: true; next: string }
  | { ok: false; error: string }

function safeNext(next: string | undefined): string {
  if (!next) return '/dashboard'
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard'
  return next
}

export async function completeOnboarding(
  input: z.infer<typeof onboardingSchema>
): Promise<OnboardingResult> {
  let data
  try {
    data = onboardingSchema.parse(input)
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof z.ZodError
          ? (err.issues[0]?.message ?? 'Invalid input')
          : 'Invalid input',
    }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: 'Not signed in' }

  // Use admin client to bypass RLS on the profile write. RLS lets the user
  // update their own profile, but we also want to set terms_version which
  // future policy could lock down — admin write is forward-compatible.
  const admin = createAdminClient()

  // First-time onboarding? We grant the Explore Pass + send a welcome email
  // only on the initial transition from "no terms" to "terms accepted".
  const { data: before } = await admin
    .from('profiles')
    .select('terms_accepted_at, email, full_name')
    .eq('id', user.id)
    .maybeSingle()
  const wasOnboarded = Boolean(
    (before as { terms_accepted_at?: string | null } | null)?.terms_accepted_at
  )

  const { error } = await admin
    .from('profiles')
    .update({
      full_name: data.fullName.trim(),
      phone: data.phone.trim(),
      terms_version: CURRENT_TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('[onboarding] profile update failed:', error)
    return { ok: false, error: 'Could not save your details. Try again.' }
  }

  if (!wasOnboarded) {
    // Best-effort: failures here shouldn't block onboarding. The user can
    // always be granted a pass manually later.
    const grant = await grantExplorePass(admin, user.id)
    if (!grant.granted && grant.reason !== 'already_granted') {
      console.warn('[onboarding] explore pass grant skipped:', grant.reason)
    }

    // Referral attribution: if the new member arrived via someone's
    // share link, record the pending referral row + clear the cookie.
    // The reward only fires on the friend's first paid event, handled
    // in the Wam webhook.
    const refCode = await readReferralCookie()
    if (refCode) {
      const attr = await attributeReferral({
        admin,
        referredUserId: user.id,
        code: refCode,
      })
      if (!attr.attributed) {
        console.info('[onboarding] referral skipped:', attr.reason)
      }
      await clearReferralCookie()
    }

    // Only email new members — pre-existing imported members don't get a
    // marketing-style welcome when they first sign in to accept terms.
    if (grant.granted || grant.reason === 'already_granted') {
      const email =
        (before as { email?: string } | null)?.email ?? user.email ?? null
      if (email) {
        const firstName = data.fullName.trim().split(/\s+/)[0] ?? ''
        await sendWelcomeEmail({
          email,
          firstName,
          explorePassExpiresAt: grant.expiresAt,
        })
      }
    }
  }

  redirect(safeNext(data.next))
}
