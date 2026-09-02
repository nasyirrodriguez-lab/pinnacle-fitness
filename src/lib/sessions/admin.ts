import type { SupabaseClient } from '@supabase/supabase-js'
import { sessionBalance, type SessionKind } from '@/lib/sessions/ledger'

// Manual corrections by the team: "+2 PT, comped after the rained-out
// session". Negative deltas can't push a member below zero.
export async function adjustSessions(
  admin: SupabaseClient,
  args: {
    userId: string
    kind: SessionKind
    delta: number
    createdBy: string
  }
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  if (!Number.isInteger(args.delta) || args.delta === 0) {
    return { ok: false, error: 'Enter a non-zero whole number' }
  }
  const current = await sessionBalance(admin, args.userId, args.kind)
  const balanceAfter = current + args.delta
  if (balanceAfter < 0) {
    return { ok: false, error: `They only have ${current} — can't go below zero` }
  }
  const { error } = await admin.from('session_ledger').insert({
    user_id: args.userId,
    kind: args.kind,
    delta: args.delta,
    balance_after: balanceAfter,
    reason: 'admin_adjust',
    created_by: args.createdBy,
  })
  if (error) return { ok: false, error: 'Could not adjust sessions' }
  return { ok: true, balance: balanceAfter }
}
