import type { SupabaseClient } from '@supabase/supabase-js'

// Called from completeOnboarding(). Looks up the referral code (set on
// the friend's browser by /r/[code] before signup), finds the referrer,
// and records the pending referral row.
//
// Idempotent: if a referrals row already exists for this referred_user_id
// (unique constraint), this is a no-op.
//
// Self-referral check: if the referral code belongs to the same user
// (somehow), we silently skip and clear the cookie.
export async function attributeReferral(args: {
  admin: SupabaseClient
  referredUserId: string
  code: string
}): Promise<{
  attributed: boolean
  reason?:
    | 'unknown_code'
    | 'self_referral'
    | 'already_attributed'
    | 'insert_failed'
}> {
  const { admin, referredUserId, code } = args

  // Case-insensitive code lookup.
  const { data: referrer } = await admin
    .from('profiles')
    .select('id, referral_code')
    .ilike('referral_code', code)
    .maybeSingle()
  const referrerRow = referrer as {
    id: string
    referral_code: string | null
  } | null
  if (!referrerRow) return { attributed: false, reason: 'unknown_code' }
  if (referrerRow.id === referredUserId) {
    return { attributed: false, reason: 'self_referral' }
  }

  const { data: existing } = await admin
    .from('referrals')
    .select('id')
    .eq('referred_user_id', referredUserId)
    .maybeSingle()
  if (existing) return { attributed: false, reason: 'already_attributed' }

  const { error } = await admin.from('referrals').insert({
    referrer_id: referrerRow.id,
    referred_user_id: referredUserId,
    code: referrerRow.referral_code ?? code,
    status: 'signed_up',
  })
  if (error) {
    console.error('[attributeReferral] insert failed:', error)
    return { attributed: false, reason: 'insert_failed' }
  }
  return { attributed: true }
}
