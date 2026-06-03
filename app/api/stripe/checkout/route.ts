import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLAN_PRICE_IDS } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import type { Member } from '@/lib/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { planSlug }: { planSlug: string } = await req.json()
  const priceId = PLAN_PRICE_IDS[planSlug]
  if (!priceId) return NextResponse.json({ error: `Unknown plan: ${planSlug}` }, { status: 400 })

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', user.id)
    .single<Member>()

  if (!member) return NextResponse.json({ error: 'Member profile not found' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Reuse existing Stripe customer if we have one
  let customerId = member.stripe_customer_id ?? undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: member.email,
      name: member.name,
      metadata: { member_id: member.id, member_code: member.member_code },
    })
    customerId = customer.id

    await supabase
      .from('members')
      .update({ stripe_customer_id: customerId })
      .eq('id', member.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/payments?success=1&plan=${planSlug}`,
    cancel_url: `${appUrl}/pricing?canceled=1`,
    subscription_data: {
      metadata: {
        member_id: member.id,
        member_code: member.member_code,
        member_name: member.name,
        plan_slug: planSlug,
      },
    },
    metadata: {
      member_id: member.id,
      member_code: member.member_code,
      member_name: member.name,
      plan_slug: planSlug,
    },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
