import { WamPaymentSDK, type WamEnvironment } from '@zed-io/wam-payment-sdk'

let cached: WamPaymentSDK | null = null

export function getWam(): WamPaymentSDK {
  if (cached) return cached

  const businessId = process.env.WAM_BUSINESS_ID
  const apiKey = process.env.WAM_API_KEY
  const environment = (process.env.WAM_ENVIRONMENT ??
    'production') as WamEnvironment

  if (!businessId || !apiKey) {
    throw new Error('WAM_BUSINESS_ID and WAM_API_KEY must be set')
  }

  cached = new WamPaymentSDK({ businessId, apiKey, environment })
  return cached
}

export function getWebhookSecret(): string {
  const s = process.env.WAM_WEBHOOK_SECRET
  if (!s) {
    throw new Error(
      'WAM_WEBHOOK_SECRET is not set. Get it from the Wam dashboard → Webhooks.'
    )
  }
  return s
}
