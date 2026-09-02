import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { ChevronLeft, Check } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getCreditBalanceCents } from '@/lib/credits/balance'
import { createAdminClient } from '@/utils/supabase/admin'
import SubscribeButton from '@/components/checkout/subscribe-button'

export const dynamic = 'force-dynamic'

const SELF_SERVE_PLAN_IDS = new Set([
  'hot-desk-monthly',
  'dedicated-desk-monthly',
])

interface PlanDetail {
  id: string
  name: string
  description: string | null
  priceCents: number
  currency: string
  billingPeriod: string
  features: string[]
}

async function loadPlan(id: string): Promise<PlanDetail | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data, error } = await supabase
    .from('plans')
    .select(
      'id, name, description, price_cents, currency, billing_period, features'
    )
    .eq('id', id)
    .eq('is_active', true)
    .eq('is_private', false)
    .maybeSingle()
  if (error || !data) return null
  const row = data as Record<string, unknown>
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    priceCents: row.price_cents as number,
    currency: row.currency as string,
    billingPeriod: row.billing_period as string,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
  }
}

interface ActiveSubscription {
  id: string
  planName: string
}

async function loadActiveSubscription(
  userId: string
): Promise<ActiveSubscription | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('subscriptions')
    .select('id, plan_id, plans(name)')
    .eq('user_id', userId)
    .in('status', ['active', 'past_due', 'paused'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const row = data as Record<string, unknown>
  const planRaw = row.plans as { name?: string } | { name?: string }[] | null
  const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw
  return {
    id: row.id as string,
    planName: plan?.name ?? (row.plan_id as string),
  }
}

interface PageProps {
  params: Promise<{ planId: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { planId } = await params
  const plan = await loadPlan(planId)
  if (!plan) return { title: 'Plan not found — The Worx' }
  return {
    title: `Subscribe to ${plan.name} — The Worx`,
    description: plan.description ?? undefined,
  }
}

export default async function SubscribePage({ params }: PageProps) {
  const { planId } = await params
  const [plan, user] = await Promise.all([loadPlan(planId), getCurrentUser()])
  const creditCents = user
    ? await getCreditBalanceCents(createAdminClient(), user.id)
    : 0
  if (!plan) notFound()
  if (!SELF_SERVE_PLAN_IDS.has(plan.id)) notFound()

  const finalPrice = `${plan.currency} $${(
    plan.priceCents / 100
  ).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

  const existingSub = user ? await loadActiveSubscription(user.id) : null
  const signInHref = `/sign-in?next=${encodeURIComponent(`/subscribe/${plan.id}`)}`

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
      <Link
        href="/spaces#plans"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-6"
      >
        <ChevronLeft size={16} />
        All plans
      </Link>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="p-6 md:p-8 border-b border-neutral-200">
          <p className="text-xs uppercase tracking-wide text-turquoise-700 font-medium mb-2">
            Subscribe to
          </p>
          <h1 className="font-heading text-3xl md:text-4xl mb-3">
            {plan.name}
          </h1>
          {plan.description && (
            <p className="text-neutral-600">{plan.description}</p>
          )}
        </div>

        <div className="p-6 md:p-8 border-b border-neutral-200">
          <dl className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Billed
              </dt>
              <dd className="font-medium text-base">
                Monthly · {finalPrice} / {plan.billingPeriod}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                First charge
              </dt>
              <dd className="font-medium text-base">{finalPrice} today</dd>
            </div>
          </dl>
        </div>

        {plan.features.length > 0 && (
          <div className="p-6 md:p-8 border-b border-neutral-200">
            <h2 className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
              What&apos;s included
            </h2>
            <ul className="space-y-2">
              {plan.features.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-neutral-700">
                  <Check
                    size={16}
                    className="text-turquoise-600 mt-0.5 shrink-0"
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-6 md:p-8 bg-neutral-50">
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-sm text-neutral-600">First month</span>
            <p className="font-heading text-3xl">{finalPrice}</p>
          </div>

          {!user ? (
            <Link href={signInHref} className="block">
              <button
                type="button"
                className="w-full bg-turquoise-500 hover:bg-turquoise-600 text-white font-medium py-3 rounded-md transition"
              >
                Sign in to subscribe
              </button>
              <p className="text-xs text-neutral-500 text-center mt-3">
                We&apos;ll email you a one-time sign-in link — no password.
              </p>
            </Link>
          ) : existingSub ? (
            <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-3 text-sm text-orange-900">
              You already have an active membership ({existingSub.planName}). To
              switch plans, email{' '}
              <a
                href="mailto:team@theworx.io"
                className="underline font-medium"
              >
                team@theworx.io
              </a>
              .
            </div>
          ) : (
            <>
              {creditCents > 0 && (
                <p className="mb-2 text-sm text-lime-800 bg-lime-50 border border-lime-200 rounded-md px-3 py-2">
                  You have TTD ${(creditCents / 100).toFixed(0)} account credit
                  {plan && creditCents >= plan.priceCents
                    ? ' — it covers this plan, no card needed.'
                    : ' — ask the front desk to apply it.'}
                </p>
              )}
              <SubscribeButton
                planId={plan.id}
                priceLabel={finalPrice}
                fullWidth
              />
              <p className="text-xs text-neutral-500 text-center mt-3">
                You&apos;ll be taken to Wam to enter your card. We&apos;ll
                charge you {finalPrice} today and remind you before next
                month&apos;s charge.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
