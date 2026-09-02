import type { SupabaseClient } from '@supabase/supabase-js'

// =====================================================================
// "Bring your crew" discount: anyone who joined through a member's
// referral link gets TTD $10 off their FIRST day-pass purchase. After
// they've bought any pass, the discount no longer applies.
// =====================================================================

export const CREW_DISCOUNT_CENTS = 1000

export async function crewDiscountCentsFor(
  admin: SupabaseClient,
  userId: string
): Promise<number> {
  // Were they referred by someone?
  const { data: referral } = await admin
    .from('referrals')
    .select('id')
    .eq('referred_user_id', userId)
    .limit(1)
    .maybeSingle()
  if (!referral) return 0

  // First pass purchase only.
  const { count } = await admin
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', 'pass')
    .eq('status', 'succeeded')
  if ((count ?? 0) > 0) return 0

  return CREW_DISCOUNT_CENTS
}
