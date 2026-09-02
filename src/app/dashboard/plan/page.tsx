import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { CreditCard, ArrowRight, Ticket } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createClient } from '@/utils/supabase/server'
import { fmtAstDate } from '@/lib/time/ast'
import PlanChangeRequest from '@/components/dashboard/plan-change-request'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Plan — The Worx',
  robots: { index: false, follow: false },
}

interface ActiveSubscription {
  id: string
  planId: string
  planName: string
  status: string
  priceCents: number
  currency: string
  billingPeriod: string
  currentPeriodEnd: string
}

interface ActivePass {
  passId: string
  passName: string
  usesRemaining: number
  expiresAt: string
}

async function loadActiveSubscription(
  userId: string
): Promise<ActiveSubscription | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data, error } = await supabase
    .from('subscriptions')
    .select(
      'id, plan_id, status, current_period_end, plans(name, price_cents, currency, billing_period)'
    )
    .eq('user_id', userId)
    .in('status', ['active', 'past_due', 'paused'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  const row = data as Record<string, unknown>
  const planRaw = row.plans as
    | {
        name?: string
        price_cents?: number
        currency?: string
        billing_period?: string
      }
    | {
        name?: string
        price_cents?: number
        currency?: string
        billing_period?: string
      }[]
    | null
  const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    planName: plan?.name ?? (row.plan_id as string),
    status: row.status as string,
    priceCents: plan?.price_cents ?? 0,
    currency: plan?.currency ?? 'TTD',
    billingPeriod: plan?.billing_period ?? 'month',
    currentPeriodEnd: row.current_period_end as string,
  }
}

async function loadActivePasses(userId: string): Promise<ActivePass[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data, error } = await supabase
    .from('pass_purchases')
    .select('pass_id, uses_remaining, expires_at, passes(name)')
    .eq('user_id', userId)
    .gt('uses_remaining', 0)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })

  if (error || !data) return []
  return (data as Record<string, unknown>[]).map((row) => {
    const passRaw = row.passes as { name?: string } | { name?: string }[] | null
    const pass = Array.isArray(passRaw) ? passRaw[0] : passRaw
    return {
      passId: row.pass_id as string,
      passName: pass?.name ?? (row.pass_id as string),
      usesRemaining: row.uses_remaining as number,
      expiresAt: row.expires_at as string,
    }
  })
}

const fmtDate = fmtAstDate

function fmtPrice(cents: number, currency: string): string {
  return `${currency} $${(cents / 100).toFixed(0)}`
}

export default async function PlanPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const [subscription, passes] = await Promise.all([
    loadActiveSubscription(user.id),
    loadActivePasses(user.id),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Plan</h1>
        <p className="text-neutral-600">
          Your active membership and day passes.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
          Membership
        </h2>
        {subscription ? (
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="font-heading text-xl mb-1">
                  {subscription.planName}
                </h3>
                <p className="text-sm text-neutral-600">
                  {fmtPrice(subscription.priceCents, subscription.currency)} /{' '}
                  {subscription.billingPeriod}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm border-t border-neutral-100 pt-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                  Status
                </dt>
                <dd className="font-medium capitalize">
                  {subscription.status.replace('_', ' ')}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                  Renews
                </dt>
                <dd className="font-medium">
                  {fmtDate(subscription.currentPeriodEnd)}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
            <CreditCard size={28} className="mx-auto mb-3 text-neutral-400" />
            <p className="font-medium mb-1">No active membership</p>
            <p className="text-sm text-neutral-500 mb-6 max-w-sm mx-auto">
              Pick a monthly plan for full-time, dedicated, or private office
              access. Or pay-as-you-go with day passes below.
            </p>
            <Link
              href="/spaces#plans"
              className="inline-flex items-center gap-1 text-sm font-medium text-turquoise-700 hover:text-turquoise-900"
            >
              See plans
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
          Membership changes
        </h2>
        <PlanChangeRequest />
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
          Day passes
        </h2>
        {passes.length > 0 ? (
          <ul className="space-y-2">
            {passes.map((p, i) => (
              <li
                key={i}
                className="bg-white border border-neutral-200 rounded-lg p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
                    <Ticket size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.passName}</p>
                    <p className="text-xs text-neutral-500">
                      Expires {fmtDate(p.expiresAt)}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-medium whitespace-nowrap">
                  {p.usesRemaining}{' '}
                  {p.usesRemaining === 1 ? 'day left' : 'days left'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
            <Ticket size={28} className="mx-auto mb-3 text-neutral-400" />
            <p className="font-medium mb-1">No day passes</p>
            <p className="text-sm text-neutral-500 mb-6">
              Buy a single day or a multi-day pass.
            </p>
            <Link
              href="/buy"
              className="inline-flex items-center gap-1 text-sm font-medium text-turquoise-700 hover:text-turquoise-900"
            >
              Buy a pass
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
