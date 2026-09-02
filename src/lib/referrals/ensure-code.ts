import type { SupabaseClient } from '@supabase/supabase-js'
import { generateReferralCode } from './codes'

// Returns the user's stable referral code, generating one if they don't
// have one yet. Idempotent. Retries on collision (very rare given the
// suffix space).
export async function ensureReferralCode(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: profile } = await admin
    .from('profiles')
    .select('referral_code, full_name, email')
    .eq('id', userId)
    .maybeSingle()
  if (!profile) return null
  const p = profile as {
    referral_code: string | null
    full_name: string | null
    email: string
  }
  if (p.referral_code) return p.referral_code

  // Try up to 5 codes in case of unique-index collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateReferralCode({
      fullName: p.full_name,
      email: p.email,
    })
    const { error } = await admin
      .from('profiles')
      .update({ referral_code: candidate })
      .eq('id', userId)
      .is('referral_code', null)
    if (!error) return candidate
  }
  console.error('[ensureReferralCode] gave up after 5 attempts:', userId)
  return null
}
