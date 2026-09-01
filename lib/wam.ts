import { WamPaymentSDK } from '@wamnow/payment-sdk'

export const PLAN_PRICES_TTD_CENTS: Record<string, number> = {
  basic: 70000,    // TT$700
  premium: 90000,  // TT$900
  elite: 100000,   // TT$1000
}

export const PLAN_NAMES: Record<string, string> = {
  basic: '8 Sessions',
  premium: '12 Sessions',
  elite: 'Unlimited',
}

let _wam: WamPaymentSDK | null = null

export function getWam(): WamPaymentSDK {
  if (!_wam) {
    _wam = new WamPaymentSDK({
      businessId: process.env.WAM_MERCHANT_ID!,
      apiKey: process.env.WAM_API_KEY!,
      webhookSecret: process.env.WAM_WEBHOOK_SECRET,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    })
  }
  return _wam
}
