import type { SupabaseClient } from '@supabase/supabase-js'

export const EXPLORE_PASS_ID = 'explore-pass'

interface GrantResult {
  granted: boolean
  expiresAt?: Date
  reason?:
    | 'already_granted'
    | 'pass_missing'
    | 'insert_failed'
    | 'pre_existing_member'
}

// Explore Pass is only for *new* members — anyone created on or after this
// date. Members imported from the legacy CSV pre-date this, so they don't
// get a free pass when they first accept terms.
const NEW_MEMBER_CUTOFF = '2026-05-15T00:00:00Z'

// Idempotent: if this user has ever held an Explore Pass (used or not),
// skip. Otherwise insert a fresh pass_purchases row with uses_remaining=1
// and expires_at = now + validity_days.
export async function grantExplorePass(
  admin: SupabaseClient,
  userId: string
): Promise<GrantResult> {
  const { data: profile } = await admin
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .maybeSingle()
  const createdAt = (profile as { created_at?: string } | null)?.created_at
  if (!createdAt || createdAt < NEW_MEMBER_CUTOFF) {
    return { granted: false, reason: 'pre_existing_member' }
  }

  const { data: existing } = await admin
    .from('pass_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('pass_id', EXPLORE_PASS_ID)
    .limit(1)
    .maybeSingle()
  if (existing) return { granted: false, reason: 'already_granted' }

  const { data: pass } = await admin
    .from('passes')
    .select('uses_total, validity_days')
    .eq('id', EXPLORE_PASS_ID)
    .maybeSingle()
  if (!pass) return { granted: false, reason: 'pass_missing' }
  const p = pass as { uses_total: number; validity_days: number }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + p.validity_days)

  const { error } = await admin.from('pass_purchases').insert({
    user_id: userId,
    pass_id: EXPLORE_PASS_ID,
    uses_total: p.uses_total,
    uses_remaining: p.uses_total,
    expires_at: expiresAt.toISOString(),
  })
  if (error) {
    console.error('[grantExplorePass] insert failed:', error)
    return { granted: false, reason: 'insert_failed' }
  }
  return { granted: true, expiresAt }
}
