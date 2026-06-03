import Stripe from 'stripe'

const globalForStripe = globalThis as unknown as { stripe?: Stripe }

export const stripe =
  globalForStripe.stripe ??
  new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-05-27.dahlia',
  })

if (process.env.NODE_ENV !== 'production') globalForStripe.stripe = stripe

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
