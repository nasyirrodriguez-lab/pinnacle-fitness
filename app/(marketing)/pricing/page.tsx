import { createClient } from '@/lib/supabase/server'
import type { Plan } from '@/lib/types'
import CheckoutButton from '@/components/pricing/CheckoutButton'

const fallbackPlans: Plan[] = [
  {
    id: '1',
    name: '8 Sessions',
    slug: 'basic',
    price: 700,
    duration: 'month',
    highlight: false,
    features: [],
  },
  {
    id: '2',
    name: '12 Sessions',
    slug: 'premium',
    price: 900,
    duration: 'month',
    highlight: true,
    features: [],
  },
  {
    id: '3',
    name: 'Unlimited',
    slug: 'elite',
    price: 1000,
    duration: 'month',
    highlight: false,
    features: [],
  },
]

const planDetails: Record<string, { name: string; description: string }> = {
  basic: {
    name: '8 Sessions',
    description: 'Eight coached sessions a month gives you the structure to stop guessing and start progressing. A coach who knows your name, knows your goals, and builds every session around getting you there. Perfect if you are balancing life and still want real results.',
  },
  premium: {
    name: '12 Sessions',
    description: 'Three sessions a week, coached, consistent, and progressive. This is the plan where most people see their biggest shift — not just physically, but mentally. You become part of the rhythm of Pinnacle. You stop waiting to feel motivated and just show up, because your coach and your community expect you to.',
  },
  elite: {
    name: 'Unlimited',
    description: 'For the fully committed. Unlimited coached sessions, open gym access, and priority scheduling mean your only job is to show up. This plan is for people who have decided that their health is non-negotiable — and want a gym that matches that energy every single day.',
  },
}

export default async function PricingPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('plans').select('*').order('price')
  const plans: Plan[] = data && data.length > 0 ? data : fallbackPlans

  return (
    <div className="bg-[#F5F0E8] min-h-screen pt-20">
      {/* Header */}
      <div className="text-center py-20 px-6">
        <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">Memberships</p>
        <h1 className="font-serif text-5xl sm:text-7xl text-[#1C1A17]">Pick your plan.</h1>
        <p className="text-[#6B6560] text-lg max-w-xl mx-auto mt-4 leading-relaxed">
          Flexible plans built for every type of athlete — whether you train twice a week or every single day.
        </p>
      </div>

      {/* Plan cards */}
      <div className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const details = planDetails[plan.slug]
          const displayName = details?.name ?? plan.name
          const description = details?.description ?? ''
          if (plan.highlight) {
            return (
              <div key={plan.id} className="bg-[#1F3D2B] rounded-2xl p-8 relative">
                <span className="absolute -top-3.5 left-6 bg-[#C85C2D] text-white text-xs font-semibold tracking-[0.1em] uppercase px-4 py-1.5 rounded-full">
                  Most Popular
                </span>
                <h2 className="font-serif text-3xl text-white mb-4">{displayName}</h2>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-serif text-3xl text-[#C85C2D]">${plan.price}</span>
                  <span className="text-white/60 text-sm">/ month</span>
                </div>
                <p className="text-white/75 text-sm leading-relaxed my-8">{description}</p>
                <CheckoutButton
                  planSlug={plan.slug}
                  planName={displayName}
                  highlight={true}
                />
              </div>
            )
          }
          return (
            <div key={plan.id} className="bg-white rounded-2xl border border-[#E8E3D9] p-8">
              <h2 className="font-serif text-3xl text-[#1C1A17] mb-4">{displayName}</h2>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-serif text-3xl text-[#C85C2D]">${plan.price}</span>
                <span className="text-[#6B6560] text-sm">/ month</span>
              </div>
              <p className="text-[#6B6560] text-sm leading-relaxed my-8">{description}</p>
              <CheckoutButton
                planSlug={plan.slug}
                planName={displayName}
                highlight={false}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
