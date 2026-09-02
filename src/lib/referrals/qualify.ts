import type { SupabaseClient } from '@supabase/supabase-js'

const REWARD_PASS_ID = 'day-pass'
const REWARD_VALIDITY_DAYS = 90

interface QualifyResult {
  qualified: boolean
  reason?:
    | 'no_pending_referral'
    | 'already_qualified'
    | 'expired'
    | 'pass_missing'
    | 'grant_failed'
}

// Called from the Wam webhook when a payment succeeds for a member who
// might have been referred. Looks up their pending referral row, flips
// it to qualified+rewarded, and grants a Day Pass to both referrer and
// referred user.
//
// Idempotent via the referrals.status check: once a row is 'rewarded'
// we skip.
export async function qualifyReferral(args: {
  admin: SupabaseClient
  referredUserId: string
}): Promise<QualifyResult> {
  const { admin, referredUserId } = args

  const { data: row } = await admin
    .from('referrals')
    .select('id, referrer_id, status, expires_at')
    .eq('referred_user_id', referredUserId)
    .maybeSingle()
  if (!row) return { qualified: false, reason: 'no_pending_referral' }
  const r = row as {
    id: string
    referrer_id: string
    status: string
    expires_at: string
  }
  if (r.status === 'qualified' || r.status === 'rewarded') {
    return { qualified: false, reason: 'already_qualified' }
  }
  if (new Date(r.expires_at).getTime() < Date.now()) {
    await admin
      .from('referrals')
      .update({ status: 'expired' })
      .eq('id', r.id)
      .eq('status', 'signed_up')
    return { qualified: false, reason: 'expired' }
  }

  // Look up the Day Pass shape so we use the right uses_total / validity.
  const { data: pass } = await admin
    .from('passes')
    .select('uses_total, validity_days')
    .eq('id', REWARD_PASS_ID)
    .maybeSingle()
  if (!pass) return { qualified: false, reason: 'pass_missing' }
  const p = pass as { uses_total: number; validity_days: number }

  const expiresAt = new Date()
  expiresAt.setDate(
    expiresAt.getDate() + Math.max(p.validity_days, REWARD_VALIDITY_DAYS)
  )

  // Grant both passes. We insert sequentially so we can capture each id
  // on the referrals row. If the first succeeds and the second fails,
  // the row will still be 'qualified' and an admin can hand-grant.
  const { data: referrerPass, error: refErr } = await admin
    .from('pass_purchases')
    .insert({
      user_id: r.referrer_id,
      pass_id: REWARD_PASS_ID,
      uses_total: p.uses_total,
      uses_remaining: p.uses_total,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()
  if (refErr || !referrerPass) {
    console.error('[qualifyReferral] referrer pass grant failed:', refErr)
    return { qualified: false, reason: 'grant_failed' }
  }

  const { data: referredPass, error: friendErr } = await admin
    .from('pass_purchases')
    .insert({
      user_id: referredUserId,
      pass_id: REWARD_PASS_ID,
      uses_total: p.uses_total,
      uses_remaining: p.uses_total,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()
  if (friendErr || !referredPass) {
    console.error('[qualifyReferral] referred pass grant failed:', friendErr)
    // Partial success — we still flip to qualified so the referrer
    // doesn't lose their grant, and surface the issue in the row.
  }

  const nowIso = new Date().toISOString()
  await admin
    .from('referrals')
    .update({
      status: referredPass ? 'rewarded' : 'qualified',
      qualified_at: nowIso,
      rewarded_at: referredPass ? nowIso : null,
      referrer_reward_pass_id: (referrerPass as { id: string }).id,
      referred_reward_pass_id: referredPass
        ? (referredPass as { id: string }).id
        : null,
    })
    .eq('id', r.id)

  return { qualified: true }
}
