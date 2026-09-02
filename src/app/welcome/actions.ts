'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { CURRENT_TERMS_VERSION } from '@/config/terms'
import { attributeReferral } from '@/lib/referrals/attribute'
import { clearReferralCookie, readReferralCookie } from '@/lib/referrals/cookie'

export const GOALS = ['strength', 'lean', 'performance', 'health'] as const
export type Goal = (typeof GOALS)[number]

const onboardingSchema = z.object({
  fullName: z.string().trim().min(1, 'Your name is required').max(120),
  phone: z
    .string()
    .trim()
    .min(7, 'A contact number is required')
    .max(40)
    .regex(/^\+?[\d\s\-()]{7,}$/, 'Enter a valid phone number'),
  goal: z.enum(GOALS),
  trainingNotes: z.string().trim().max(1000).optional().nullable(),
  preferredCoach: z.enum(['nasyir', 'matthew', 'none']),
  pin: z.string().regex(/^\d{4}$/, 'Your PIN is four digits'),
  acceptTerms: z.literal(true, {
    message: 'You need to accept the Member Code to continue',
  }),
  next: z.string().optional(),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>
export type OnboardingResult =
  | { ok: true; next: string }
  | { ok: false; error: string }

function safeNext(next: string | undefined): string {
  if (!next) return '/dashboard'
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard'
  return next
}

// Rejects the PINs everyone picks first.
const WEAK_PINS = new Set(['0000', '1234', '1111', '2222', '4321', '9999'])

export async function completeOnboarding(
  input: OnboardingInput
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
  if (WEAK_PINS.has(data.pin)) {
    return { ok: false, error: 'Pick a PIN that’s a little harder to guess.' }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const admin = createAdminClient()

  let preferredCoachId: string | null = null
  if (data.preferredCoach !== 'none') {
    const { data: coach } = await admin
      .from('coaches')
      .select('id')
      .eq('slug', data.preferredCoach)
      .maybeSingle()
    preferredCoachId = (coach as { id: string } | null)?.id ?? null
  }

  const { data: before } = await admin
    .from('profiles')
    .select('terms_accepted_at')
    .eq('id', user.id)
    .maybeSingle()
  const wasOnboarded = Boolean(
    (before as { terms_accepted_at?: string | null } | null)?.terms_accepted_at
  )

  const { error } = await admin
    .from('profiles')
    .update({
      full_name: data.fullName,
      phone: data.phone,
      goal: data.goal,
      training_notes: data.trainingNotes?.trim() || null,
      preferred_coach_id: preferredCoachId,
      pin_code: data.pin,
      terms_version: CURRENT_TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) {
    console.error('[onboarding] profile update failed:', error)
    return { ok: false, error: 'Could not save your details. Try again.' }
  }

  // Referral attribution on first completion: if they arrived via a
  // member's share link, record it. The reward fires on first paid event.
  if (!wasOnboarded) {
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
  }

  redirect(safeNext(data.next))
}

// The step that sets a PIN later from Settings reuses this.
export async function updatePin(input: {
  pin: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^\d{4}$/.test(input.pin)) {
    return { ok: false, error: 'Your PIN is four digits' }
  }
  if (WEAK_PINS.has(input.pin)) {
    return { ok: false, error: 'Pick a PIN that’s a little harder to guess.' }
  }
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }
  const { error } = await createAdminClient()
    .from('profiles')
    .update({ pin_code: input.pin })
    .eq('id', user.id)
  if (error) return { ok: false, error: 'Could not save your PIN' }
  return { ok: true }
}
