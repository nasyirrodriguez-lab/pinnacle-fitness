import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook signature verification failed'
    console.error('[Webhook] Signature error:', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const db = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const meta = session.metadata ?? {}
        const memberId: string = meta.member_id
        const planSlug: string = meta.plan_slug
        const memberName: string = meta.member_name

        // Retrieve subscription + expand items so we can get current_period_end
        const sub = await stripe.subscriptions.retrieve(session.subscription as string, {
          expand: ['items', 'latest_invoice'],
        })

        // In Stripe v22 current_period_end lives on the SubscriptionItem
        const firstItem = sub.items.data[0]
        const periodEnd = firstItem?.current_period_end
          ? new Date(firstItem.current_period_end * 1000).toISOString()
          : null

        const invoice = sub.latest_invoice as Stripe.Invoice | null
        const amount = (invoice?.amount_paid ?? 0) / 100
        const invoiceUrl = invoice?.hosted_invoice_url ?? null
        const invoiceId = invoice?.id ?? null

        // payment_intent lives inside invoice.parent in v22
        const piId = resolvePaymentIntentId(invoice)

        await db
          .from('members')
          .update({
            plan_type: planSlug,
            status: 'active',
            current_period_end: periodEnd,
            stripe_customer_id: session.customer as string,
          })
          .eq('id', memberId)

        await db.from('payments').insert({
          member_id: memberId,
          member_name: memberName,
          plan_type: planSlug,
          amount,
          paid_at: new Date().toISOString(),
          status: 'paid',
          payment_intent_id: piId,
          stripe_invoice_id: invoiceId,
          invoice_url: invoiceUrl,
        })

        console.log(`[Webhook] checkout.session.completed member=${memberId} plan=${planSlug}`)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice

        // Subscription id is in invoice.parent.subscription_details.subscription (v22)
        const subId = getSubscriptionId(invoice)
        if (!subId) break

        const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items'] })

        // Skip the initial subscription_create invoice (handled by checkout.session.completed)
        if (invoice.billing_reason === 'subscription_create') break

        const planSlug = sub.metadata?.plan_slug
        const memberId = sub.metadata?.member_id
        const memberName = sub.metadata?.member_name
        if (!memberId || !planSlug) {
          console.warn('[Webhook] invoice.payment_succeeded: missing sub metadata', sub.id)
          break
        }

        const firstItem = sub.items.data[0]
        const periodEnd = firstItem?.current_period_end
          ? new Date(firstItem.current_period_end * 1000).toISOString()
          : null

        const piId = resolvePaymentIntentId(invoice)

        await db
          .from('members')
          .update({ status: 'active', current_period_end: periodEnd })
          .eq('id', memberId)

        await db.from('payments').insert({
          member_id: memberId,
          member_name: memberName ?? '',
          plan_type: planSlug,
          amount: (invoice.amount_paid ?? 0) / 100,
          paid_at: new Date(invoice.created * 1000).toISOString(),
          status: 'paid',
          payment_intent_id: piId,
          stripe_invoice_id: invoice.id,
          invoice_url: invoice.hosted_invoice_url ?? null,
        })

        console.log(`[Webhook] invoice.payment_succeeded renewal member=${memberId}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId = getSubscriptionId(invoice)
        if (!subId) break

        const sub = await stripe.subscriptions.retrieve(subId)
        const memberId = sub.metadata?.member_id
        const planSlug = sub.metadata?.plan_slug
        const memberName = sub.metadata?.member_name
        if (!memberId) break

        const piId = resolvePaymentIntentId(invoice)

        await db.from('payments').insert({
          member_id: memberId,
          member_name: memberName ?? '',
          plan_type: planSlug ?? 'basic',
          amount: (invoice.amount_due ?? 0) / 100,
          paid_at: new Date(invoice.created * 1000).toISOString(),
          status: 'failed',
          payment_intent_id: piId,
          stripe_invoice_id: invoice.id,
          invoice_url: invoice.hosted_invoice_url ?? null,
        })

        console.log(`[Webhook] invoice.payment_failed member=${memberId}`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const memberId = sub.metadata?.member_id
        if (memberId) {
          console.log(`[Webhook] subscription cancelled member=${memberId}`)
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('[Webhook] Handler error:', err)
    return NextResponse.json({ error: 'Internal handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ── helpers for v22 field changes ──────────────────────────────────────────

function getSubscriptionId(invoice: Stripe.Invoice): string | null {
  // v22: subscription lives inside invoice.parent.subscription_details
  const parent = invoice.parent as {
    type?: string
    subscription_details?: { subscription?: string | Stripe.Subscription }
  } | null

  if (parent?.type === 'subscription_details' && parent.subscription_details?.subscription) {
    const s = parent.subscription_details.subscription
    return typeof s === 'string' ? s : s.id
  }
  return null
}

function resolvePaymentIntentId(invoice: Stripe.Invoice | null): string | null {
  if (!invoice) return null
  // v22: payment_intent is nested inside invoice.parent for payment invoices
  const parent = invoice.parent as {
    type?: string
    payment_details?: { payment_intent?: string | Stripe.PaymentIntent }
  } | null

  if (parent?.type === 'payment_details' && parent.payment_details?.payment_intent) {
    const pi = parent.payment_details.payment_intent
    return typeof pi === 'string' ? pi : pi.id
  }
  return null
}
