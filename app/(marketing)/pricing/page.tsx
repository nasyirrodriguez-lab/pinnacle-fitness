import { createClient } from '@/lib/supabase/server'
import type { Plan } from '@/lib/types'
import CheckoutButton from '@/components/pricing/CheckoutButton'

const fallbackPlans: Plan[] = [
  {
    id: '1',
    name: 'Basic',
    slug: 'basic',
    price: 29,
    duration: 'month',
    highlight: false,
    features: [
      'Full gym floor access',
      'Cardio equipment',
      'Locker rooms & showers',
      'Free fitness assessment',
    ],
  },
  {
    id: '2',
    name: 'Premium',
    slug: 'premium',
    price: 59,
    duration: 'month',
    highlight: true,
    features: [
      'Everything in Basic',
      'Unlimited group classes',
      'Sauna & steam room',
      '2 guest passes/month',
      'Nutrition workshop access',
    ],
  },
  {
    id: '3',
    name: 'Elite',
    slug: 'elite',
    price: 99,
    duration: 'month',
    highlight: false,
    features: [
      'Everything in Premium',
      '4 PT sessions/month',
      '24/7 gym access',
      'Dedicated locker',
      'Quarterly body composition scan',
      'Priority class booking',
    ],
  },
]

export default async function PricingPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('plans').select('*').order('price')
  const plans: Plan[] = data && data.length > 0 ? data : fallbackPlans

  return (
    <div className="bg-zinc-950">
      {/* Header */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-black text-white">Simple, Honest Pricing</h1>
        <p className="mt-4 text-zinc-400 max-w-lg mx-auto text-sm sm:text-base">
          No hidden fees. No long-term lock-ins. Pick the plan that fits your goals and cancel any time.
        </p>
      </section>

      {/* Plans grid */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                plan.highlight
                  ? 'border-orange-500 bg-zinc-900 shadow-2xl shadow-orange-500/10 scale-[1.02]'
                  : 'border-zinc-800 bg-zinc-900'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-orange-500 px-4 py-1 text-xs font-bold text-white shadow">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-black text-white">${plan.price}</span>
                  <span className="text-zinc-500 text-sm mb-1">/{plan.duration}</span>
                </div>
                <p className="mt-2 text-xs text-zinc-600">Billed monthly · Cancel anytime</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <svg
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <CheckoutButton
                planSlug={plan.slug}
                planName={plan.name}
                highlight={plan.highlight}
              />
            </div>
          ))}
        </div>

        {/* Stripe badge */}
        <div className="mt-8 flex justify-center">
          <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-zinc-500">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            Payments secured by Stripe · 256-bit SSL
          </div>
        </div>

        {/* FAQ strip */}
        <div className="mt-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
          <h3 className="text-lg font-bold text-white mb-6 text-center">Common Questions</h3>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { q: 'Is there a joining fee?', a: 'No joining fees, ever. Pay only your monthly plan.' },
              { q: 'Can I switch plans?', a: 'Yes — upgrade or downgrade at any time from your billing portal.' },
              { q: 'Is there a contract?', a: 'No contracts. Cancel anytime directly from your dashboard.' },
              { q: 'Do you offer student discounts?', a: 'Contact us with your student ID for 20% off any plan.' },
            ].map(({ q, a }) => (
              <div key={q}>
                <p className="text-sm font-semibold text-white mb-1">{q}</p>
                <p className="text-sm text-zinc-500">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
