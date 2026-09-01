import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWam, PLAN_PRICES_TTD_CENTS, PLAN_NAMES } from '@/lib/wam'
import type { Member } from '@/lib/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { planSlug }: { planSlug: string } = await req.json()

  const amountCents = PLAN_PRICES_TTD_CENTS[planSlug]
  if (!amountCents) return NextResponse.json({ error: `Unknown plan: ${planSlug}` }, { status: 400 })

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', user.id)
    .single<Member>()

  if (!member) return NextResponse.json({ error: 'Member profile not found' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const planName = PLAN_NAMES[planSlug] ?? planSlug

  const intent = await getWam().createPaymentIntent({
    amountCents,
    currency: 'TTD',
    orderReference: `${member.member_code}-${planSlug}-${Date.now()}`,
    description: `Pinnacle Fitness — ${planName} plan`,
    returnUrl: `${appUrl}/dashboard/payments?success=1&plan=${planSlug}`,
    metadata: {
      member_id: member.id,
      member_code: member.member_code,
      plan_slug: planSlug,
      user_id: user.id,
    },
  })

  return NextResponse.json({ url: intent.checkoutUrl })
}
