// Shared price helper for passes + plans. Both tables carry an optional
// `discounted_price_cents` and `discount_expires_at`. The discount is
// "active" as long as it has both a discounted value and (no expiry OR
// the expiry is in the future). After expiry the helper returns the
// regular price only — no code change needed at the cutover.

export interface PriceInput {
  priceCents: number
  discountedPriceCents: number | null
  discountExpiresAt: string | null
}

export interface PriceInputSnakeCase {
  price_cents: number
  discounted_price_cents: number | null
  discount_expires_at: string | null
}

export interface EffectivePrice {
  regularCents: number
  discountedCents: number | null
  effectiveCents: number
  isDiscountActive: boolean
  expiresAt: string | null
}

// Accept either camelCase or snake_case so callers don't need to remap.
export function effectivePrice(
  item: PriceInput | PriceInputSnakeCase,
  nowMs: number = Date.now()
): EffectivePrice {
  const regularCents = 'priceCents' in item ? item.priceCents : item.price_cents
  const discountedCents =
    'discountedPriceCents' in item
      ? item.discountedPriceCents
      : item.discounted_price_cents
  const expiresAt =
    'discountExpiresAt' in item
      ? item.discountExpiresAt
      : item.discount_expires_at

  const hasDiscount =
    discountedCents !== null &&
    discountedCents !== undefined &&
    discountedCents < regularCents
  const notYetExpired = !expiresAt || new Date(expiresAt).getTime() > nowMs

  const isDiscountActive = hasDiscount && notYetExpired

  return {
    regularCents,
    discountedCents: hasDiscount ? (discountedCents as number) : null,
    effectiveCents: isDiscountActive
      ? (discountedCents as number)
      : regularCents,
    isDiscountActive,
    expiresAt: expiresAt ?? null,
  }
}

export function fmtTtd(cents: number): string {
  return `TTD $${(cents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

export function fmtSavings(p: EffectivePrice): string | null {
  if (!p.isDiscountActive || p.discountedCents === null) return null
  const save = p.regularCents - p.discountedCents
  return `Save ${fmtTtd(save)}`
}

export function fmtPromoEndShort(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/Port_of_Spain',
    month: 'short',
    day: 'numeric',
  })
}
