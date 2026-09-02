import type { SupabaseClient } from '@supabase/supabase-js'

// The session ledger is the single source of "how many sessions do I
// have left". Every grant (plan month, pack purchase) and every use
// (check-in, no-show, late cancel) is a row; the balance is the sum.
// Packs carry an expires_at so the expiry cron can write them off.

export type SessionKind = 'pt' | 'open_gym'

export type LedgerReason =
  | 'plan_grant'
  | 'pack_purchase'
  | 'booking_use'
  | 'checkin_use'
  | 'no_show'
  | 'late_cancel'
  | 'refund'
  | 'expiry'
  | 'admin_adjust'

export interface LedgerEntry {
  id: string
  kind: SessionKind
  delta: number
  balanceAfter: number
  reason: LedgerReason
  bookingId: string | null
  expiresAt: string | null
  createdAt: string
}

export async function sessionBalance(
  admin: SupabaseClient,
  userId: string,
  kind: SessionKind
): Promise<number> {
  const { data } = await admin
    .from('session_ledger')
    .select('delta')
    .eq('user_id', userId)
    .eq('kind', kind)
  return ((data as { delta: number }[] | null) ?? []).reduce(
    (sum, r) => sum + (r.delta ?? 0),
    0
  )
}

async function appendEntry(
  admin: SupabaseClient,
  args: {
    userId: string
    kind: SessionKind
    delta: number
    reason: LedgerReason
    bookingId?: string | null
    paymentId?: string | null
    passPurchaseId?: string | null
    expiresAt?: string | null
    createdBy?: string | null
  }
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const current = await sessionBalance(admin, args.userId, args.kind)
  const balanceAfter = current + args.delta
  const { error } = await admin.from('session_ledger').insert({
    user_id: args.userId,
    kind: args.kind,
    delta: args.delta,
    balance_after: balanceAfter,
    reason: args.reason,
    booking_id: args.bookingId ?? null,
    payment_id: args.paymentId ?? null,
    pass_purchase_id: args.passPurchaseId ?? null,
    expires_at: args.expiresAt ?? null,
    created_by: args.createdBy ?? null,
  })
  if (error) {
    console.error('[ledger] insert failed:', error)
    return { ok: false, error: 'Could not update sessions' }
  }
  return { ok: true, balance: balanceAfter }
}

export async function grantSessions(
  admin: SupabaseClient,
  args: {
    userId: string
    kind: SessionKind
    count: number
    reason: 'plan_grant' | 'pack_purchase' | 'admin_adjust' | 'refund'
    paymentId?: string | null
    passPurchaseId?: string | null
    expiresAt?: string | null
    createdBy?: string | null
  }
) {
  if (args.count <= 0) return { ok: true as const, balance: 0 }
  return appendEntry(admin, { ...args, delta: args.count })
}

// Spend one session. Refuses when the balance is already zero so a
// check-in can never push a member negative.
export async function spendSession(
  admin: SupabaseClient,
  args: {
    userId: string
    kind: SessionKind
    reason: 'checkin_use' | 'booking_use' | 'no_show' | 'late_cancel'
    bookingId?: string | null
    createdBy?: string | null
  }
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const current = await sessionBalance(admin, args.userId, args.kind)
  if (current <= 0) return { ok: false, error: 'no_sessions_left' }
  return appendEntry(admin, { ...args, delta: -1 })
}

export async function refundSession(
  admin: SupabaseClient,
  args: {
    userId: string
    kind: SessionKind
    bookingId?: string | null
    createdBy?: string | null
  }
) {
  return appendEntry(admin, { ...args, delta: 1, reason: 'refund' })
}

// Monthly plans hard-reset: write off whatever plan balance is left,
// then grant the new month. Pack balances are left alone — they carry
// their own expiry.
export async function resetMonthlyGrant(
  admin: SupabaseClient,
  args: {
    userId: string
    kind: SessionKind
    perMonth: number
    paymentId?: string | null
  }
) {
  const { data: rows } = await admin
    .from('session_ledger')
    .select('delta, reason, expires_at')
    .eq('user_id', args.userId)
    .eq('kind', args.kind)
  const all =
    (rows as
      | { delta: number; reason: string; expires_at: string | null }[]
      | null) ?? []
  // Pack grants still in date are protected; everything else is the
  // plan bucket (grants + uses) and resets to zero.
  const now = Date.now()
  const packRemaining = all
    .filter(
      (r) =>
        r.reason === 'pack_purchase' &&
        r.expires_at &&
        new Date(r.expires_at).getTime() > now
    )
    .reduce((s, r) => s + r.delta, 0)
  const total = all.reduce((s, r) => s + r.delta, 0)
  const planLeft = total - Math.max(0, packRemaining)
  if (planLeft > 0) {
    await appendEntry(admin, {
      userId: args.userId,
      kind: args.kind,
      delta: -planLeft,
      reason: 'expiry',
    })
  }
  return grantSessions(admin, {
    userId: args.userId,
    kind: args.kind,
    count: args.perMonth,
    reason: 'plan_grant',
    paymentId: args.paymentId ?? null,
  })
}

// Pack expiry: called by the daily cron. Any pack grant past its
// expires_at that hasn't been written off yet gets an offsetting
// 'expiry' row for whatever of it is still unused.
export async function expirePacks(
  admin: SupabaseClient
): Promise<{ expired: number }> {
  const nowIso = new Date().toISOString()
  const { data: grants } = await admin
    .from('session_ledger')
    .select('id, user_id, kind, delta, pass_purchase_id, expires_at')
    .eq('reason', 'pack_purchase')
    .lt('expires_at', nowIso)
  let expired = 0
  for (const g of (grants as
    | {
        id: string
        user_id: string
        kind: SessionKind
        delta: number
        pass_purchase_id: string | null
        expires_at: string
      }[]
    | null) ?? []) {
    // Already written off?
    const { data: done } = await admin
      .from('session_ledger')
      .select('id')
      .eq('reason', 'expiry')
      .eq('pass_purchase_id', g.pass_purchase_id ?? '')
      .limit(1)
    if (g.pass_purchase_id && done && done.length > 0) continue
    const balance = await sessionBalance(admin, g.user_id, g.kind)
    const writeOff = Math.min(balance, g.delta)
    if (writeOff <= 0) continue
    const r = await appendEntry(admin, {
      userId: g.user_id,
      kind: g.kind,
      delta: -writeOff,
      reason: 'expiry',
      passPurchaseId: g.pass_purchase_id,
    })
    if (r.ok) expired++
  }
  return { expired }
}

export async function listLedger(
  admin: SupabaseClient,
  userId: string,
  limit = 30
): Promise<LedgerEntry[]> {
  const { data } = await admin
    .from('session_ledger')
    .select(
      'id, kind, delta, balance_after, reason, booking_id, expires_at, created_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: r.id as string,
    kind: r.kind as SessionKind,
    delta: r.delta as number,
    balanceAfter: r.balance_after as number,
    reason: r.reason as LedgerReason,
    bookingId: (r.booking_id as string | null) ?? null,
    expiresAt: (r.expires_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }))
}
