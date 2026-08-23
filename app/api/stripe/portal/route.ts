import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import type { Member } from '@/lib/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('members')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single<Pick<Member, 'stripe_customer_id'>>()

  if (!member?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found. Purchase a plan first.' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await getStripe().billingPortal.sessions.create({
    customer: member.stripe_customer_id,
    return_url: `${appUrl}/dashboard/payments`,
  })

  return NextResponse.json({ url: session.url })
}
