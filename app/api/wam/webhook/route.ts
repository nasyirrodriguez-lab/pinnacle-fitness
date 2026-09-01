import { NextRequest, NextResponse } from 'next/server'
import { WamPaymentSDK } from '@wamnow/payment-sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PlanType } from '@/lib/types'

export async function POST(req: NextRequest) {
  const payload = await req.text()
  const signature = req.headers.get('x-wam-signature') ?? ''
  const timestamp = req.headers.get('x-wam-timestamp') ?? ''
  const secret = process.env.WAM_WEBHOOK_SECRET

  if (!secret) {
    console.error('[WAM webhook] WAM_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event
  try {
    event = WamPaymentSDK.verifyWebhookSignature({ payload, signature, timestamp, secret })
  } catch (err) {
    console.error('[WAM webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const data = event.data as {
      paymentId: string
      metadata?: { member_id?: string; plan_slug?: string }
    }

    const { member_id, plan_slug } = data.metadata ?? {}

    if (member_id && plan_slug) {
      const admin = createAdminClient()

      const periodEnd = new Date()
      periodEnd.setMonth(periodEnd.getMonth() + 1)

      const { error } = await admin
        .from('members')
        .update({
          plan_type: plan_slug as PlanType,
          status: 'active',
          current_period_end: periodEnd.toISOString(),
        })
        .eq('id', member_id)

      if (error) {
        console.error('[WAM webhook] DB update failed:', error.message)
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
      }

      console.log(`[WAM webhook] Updated member ${member_id} to plan ${plan_slug}`)
    }
  }

  return NextResponse.json({ received: true })
}
