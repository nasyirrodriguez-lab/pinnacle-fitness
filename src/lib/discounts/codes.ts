import type { SupabaseClient } from '@supabase/supabase-js'

// Discount codes: validated the same way on every purchase surface —
// online checkout, the kiosk, and the admin payment recorder. Uses are
// counted from payments metadata (discountCodeId), so a code use only
// "burns" when a payment actually exists.

export type CodeFailure =
  | 'not_found'
  | 'inactive'
  | 'expired'
  | 'not_applicable'
  | 'limit_reached'

export type CodeValidation =
  | { ok: true; codeId: string; code: string; percentOff: number }
  | { ok: false; reason: CodeFailure }

export function codeFailureMessage(reason: CodeFailure): string {
  switch (reason) {
    case 'not_found':
      return "That code doesn't exist — check the spelling."
    case 'inactive':
      return 'That code is no longer active.'
    case 'expired':
      return 'That code has expired.'
    case 'not_applicable':
      return "That code doesn't apply to this product."
    case 'limit_reached':
      return "You've already used this code the maximum number of times."
  }
}

interface AppliesTo {
  kind: 'plan' | 'pass'
  id: string
}

function parseAppliesTo(raw: unknown): AppliesTo[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (i): i is AppliesTo =>
      typeof i === 'object' &&
      i !== null &&
      ((i as AppliesTo).kind === 'plan' || (i as AppliesTo).kind === 'pass') &&
      typeof (i as AppliesTo).id === 'string'
  )
}

export async function validateDiscountCode(
  admin: SupabaseClient,
  args: {
    code: string
    userId: string | null
    kind: 'plan' | 'pass'
    productId: string
  }
): Promise<CodeValidation> {
  const normalized = args.code.trim().toUpperCase()
  if (!normalized) return { ok: false, reason: 'not_found' }

  const { data } = await admin
    .from('discount_codes')
    .select(
      'id, code, percent_off, applies_to, max_uses_per_member, expires_at, is_active'
    )
    .eq('code', normalized)
    .maybeSingle()
  if (!data) return { ok: false, reason: 'not_found' }

  const row = data as {
    id: string
    code: string
    percent_off: number
    applies_to: unknown
    max_uses_per_member: number | null
    expires_at: string | null
    is_active: boolean
  }
  if (!row.is_active) return { ok: false, reason: 'inactive' }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  const applies = parseAppliesTo(row.applies_to)
  if (
    applies.length > 0 &&
    !applies.some((a) => a.kind === args.kind && a.id === args.productId)
  ) {
    return { ok: false, reason: 'not_applicable' }
  }

  if (row.max_uses_per_member != null && args.userId) {
    // Pending payments count too, so a code can't be double-dipped
    // while a checkout is in flight.
    const { count } = await admin
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', args.userId)
      .in('status', ['pending', 'succeeded'])
      .eq('metadata->>discountCodeId', row.id)
    if ((count ?? 0) >= row.max_uses_per_member) {
      return { ok: false, reason: 'limit_reached' }
    }
  }

  return {
    ok: true,
    codeId: row.id,
    code: row.code,
    percentOff: row.percent_off,
  }
}

export function applyPercentOff(cents: number, percentOff: number): number {
  return Math.max(0, Math.round((cents * (100 - percentOff)) / 100))
}
