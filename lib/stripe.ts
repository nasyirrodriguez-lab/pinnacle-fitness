import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-05-27.dahlia',
    })
  }
  return _stripe
}

// Plan slug → Stripe recurring Price ID (configure in Stripe dashboard)
export const PLAN_PRICE_IDS: Record<string, string> = {
  basic: process.env.STRIPE_PRICE_BASIC!,
  premium: process.env.STRIPE_PRICE_PREMIUM!,
  elite: process.env.STRIPE_PRICE_ELITE!,
}

export const PLAN_AMOUNTS: Record<string, number> = {
  basic: 2900,
  premium: 5900,
  elite: 9900,
}
