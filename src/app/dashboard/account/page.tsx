import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  CreditCard,
  Ticket,
  Receipt,
  Coins,
  ScanLine,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCreditBalanceCents } from '@/lib/credits/balance'
import { signedVisitorPhotoUrl } from '@/lib/photos/upload'
import { fmtAstDate, fmtAstDateTime } from '@/lib/time/ast'
import ProfilePhotoCard from '@/components/dashboard/profile-photo-card'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Account — The Worx',
  robots: { index: false, follow: false },
}

interface ActiveSubscription {
  planName: string
  status: string
  priceCents: number
  currency: string
  billingPeriod: string
  currentPeriodEnd: string
}

interface ActivePass {
  passName: string
  usesRemaining: number
  expiresAt: string
}

interface CreditState {
  balanceCents: number
  nextExpiry: string | null
  recent: Array<{
    id: string
    amountCents: number
    reason: string
    createdAt: string
  }>
}

async function loadCredits(userId: string): Promise<CreditState> {
  const admin = createAdminClient()
  const [balanceCents, { data: grants }, { data: recent }] = await Promise.all([
    getCreditBalanceCents(admin, userId),
    admin
      .from('credit_grants')
      .select('expires_at')
      .eq('user_id', userId)
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })
      .limit(1),
    admin
      .from('credit_ledger')
      .select('id, amount_cents, reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])
  const nextExpiry =
    (grants as Array<{ expires_at: string }> | null)?.[0]?.expires_at ?? null
  const recentRows = (
    (recent as Array<{
      id: string
      amount_cents: number
      reason: string
      created_at: string
    }> | null) ?? []
  ).map((r) => ({
    id: r.id,
    amountCents: r.amount_cents,
    reason: r.reason,
    createdAt: r.created_at,
  }))
  return { balanceCents, nextExpiry, recent: recentRows }
}

async function loadActive(userId: string): Promise<{
  subscription: ActiveSubscription | null
  passes: ActivePass[]
}> {
  const admin = createAdminClient()
  const [{ data: subRaw }, { data: passesRaw }] = await Promise.all([
    admin
      .from('subscriptions')
      .select(
        'plan_id, status, current_period_end, plans(name, price_cents, currency, billing_period)'
      )
      .eq('user_id', userId)
      .in('status', ['active', 'past_due', 'paused'])
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('pass_purchases')
      .select('uses_remaining, expires_at, passes(name)')
      .eq('user_id', userId)
      .gt('uses_remaining', 0)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true }),
  ])

  let subscription: ActiveSubscription | null = null
  if (subRaw) {
    const r = subRaw as Record<string, unknown>
    const planRaw = r.plans as
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
    if (plan) {
      subscription = {
        planName: plan.name ?? (r.plan_id as string),
        status: r.status as string,
        priceCents: plan.price_cents ?? 0,
        currency: plan.currency ?? 'TTD',
        billingPeriod: plan.billing_period ?? 'month',
        currentPeriodEnd: r.current_period_end as string,
      }
    }
  }

  const passes: ActivePass[] = (
    (passesRaw as Record<string, unknown>[] | null) ?? []
  ).map((row) => {
    const passRaw = row.passes as { name?: string } | { name?: string }[] | null
    const pass = Array.isArray(passRaw) ? passRaw[0] : passRaw
    return {
      passName: pass?.name ?? 'Pass',
      usesRemaining: row.uses_remaining as number,
      expiresAt: row.expires_at as string,
    }
  })

  return { subscription, passes }
}

const fmtDate = fmtAstDate

function fmtTtd(cents: number, currency: string): string {
  return `${currency} $${(cents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

interface VisitItem {
  id: string
  checkedInAt: string
  checkedOutAt: string | null
  kind: string
}

async function loadVisits(userId: string): Promise<VisitItem[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('visits')
    .select('id, checked_in_at, checked_out_at, kind')
    .eq('user_id', userId)
    .order('checked_in_at', { ascending: false })
    .limit(20)
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: r.id as string,
    checkedInAt: r.checked_in_at as string,
    checkedOutAt: (r.checked_out_at as string | null) ?? null,
    kind: (r.kind as string) ?? 'member',
  }))
}

const fmtDateTime = fmtAstDateTime

export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const [{ subscription, passes }, credits, visits, selfieRow] =
    await Promise.all([
      loadActive(user.id),
      loadCredits(user.id),
      loadVisits(user.id),
      createAdminClient()
        .from('profiles')
        .select('selfie_path')
        .eq('id', user.id)
        .maybeSingle(),
    ])
  const totalPasses = passes.reduce((sum, p) => sum + p.usesRemaining, 0)
  const selfiePath =
    (selfieRow.data as { selfie_path?: string | null } | null)?.selfie_path ??
    null
  const photoUrl = selfiePath ? await signedVisitorPhotoUrl(selfiePath) : null

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Account</h1>
        <p className="text-neutral-600">
          Who you are and what you&apos;ve got.
        </p>
      </div>

      <section className="bg-white border border-neutral-200 rounded-lg p-6 mb-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
          Your photo
        </p>
        <ProfilePhotoCard currentPhotoUrl={photoUrl} />
      </section>

      {/* Identity card */}
      <section className="bg-white border border-neutral-200 rounded-lg p-6 mb-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
          Member
        </p>
        <p className="font-heading text-2xl mb-1">
          {user.fullName ?? user.email}
        </p>
        <p className="text-sm text-neutral-600 mb-4">{user.email}</p>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          {user.company && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                Company
              </dt>
              <dd className="font-medium">{user.company}</dd>
            </div>
          )}
          {user.phone && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                Phone
              </dt>
              <dd className="font-medium">{user.phone}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
              Role
            </dt>
            <dd className="font-medium">
              {user.role === 'admin' ? 'Admin' : 'Member'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
              Member since
            </dt>
            <dd className="font-medium">{fmtDate(user.termsAcceptedAt)}</dd>
          </div>
        </dl>
      </section>

      {/* Active plan */}
      <section className="bg-white border border-neutral-200 rounded-lg p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
            <CreditCard size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
              Active plan
            </p>
            {subscription ? (
              <>
                <p className="font-heading text-xl mb-1">
                  {subscription.planName}
                </p>
                <p className="text-sm text-neutral-600">
                  {fmtTtd(subscription.priceCents, subscription.currency)} /{' '}
                  {subscription.billingPeriod} · renews{' '}
                  {fmtDate(subscription.currentPeriodEnd)}
                </p>
              </>
            ) : (
              <>
                <p className="font-heading text-xl mb-1">No monthly plan</p>
                <p className="text-sm text-neutral-600">
                  Pick one any time, or pay-as-you-go with day passes.
                </p>
              </>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-wrap gap-3">
          <Link
            href="/dashboard/plan"
            className="inline-flex items-center gap-1 text-sm font-medium text-turquoise-700 hover:text-turquoise-900"
          >
            Manage plan & billing
            <ArrowRight size={14} />
          </Link>
          {!subscription && (
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1 text-sm font-medium text-turquoise-700 hover:text-turquoise-900"
            >
              See plans
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </section>

      {credits.balanceCents > 0 && (
        <section className="bg-white border border-neutral-200 rounded-lg p-6 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-lime-50 text-lime-700 flex items-center justify-center shrink-0">
              <Coins size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                Account credit
              </p>
              <p className="font-heading text-xl mb-1">
                TTD ${(credits.balanceCents / 100).toLocaleString('en-US')}{' '}
                available
              </p>
              <p className="text-sm text-neutral-600">
                Applied automatically against your next purchase.
                {credits.nextExpiry && (
                  <>
                    {' '}
                    Soonest expiry:{' '}
                    <strong>{fmtDate(credits.nextExpiry)}</strong>.
                  </>
                )}
              </p>
              {credits.recent.length > 0 && (
                <ul className="mt-3 text-xs text-neutral-500 space-y-0.5">
                  {credits.recent.map((r) => (
                    <li key={r.id}>
                      {fmtDate(r.createdAt)} ·{' '}
                      <span
                        className={
                          r.amountCents >= 0
                            ? 'text-lime-700'
                            : 'text-neutral-700'
                        }
                      >
                        {r.amountCents >= 0 ? '+' : '−'}TTD $
                        {(Math.abs(r.amountCents) / 100).toLocaleString(
                          'en-US'
                        )}
                      </span>{' '}
                      · {r.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white border border-neutral-200 rounded-lg p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
            <Ticket size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
              Day passes
            </p>
            {totalPasses === 0 ? (
              <>
                <p className="font-heading text-xl mb-1">No active passes</p>
                <p className="text-sm text-neutral-600">
                  Buy a single day or a multi-day pack.
                </p>
              </>
            ) : (
              <>
                <p className="font-heading text-xl mb-1">
                  {totalPasses} {totalPasses === 1 ? 'day' : 'days'} available
                </p>
                <ul className="text-xs text-neutral-500 space-y-0.5">
                  {passes.map((p, i) => (
                    <li key={i}>
                      {p.passName} — {p.usesRemaining} remaining, expires{' '}
                      {fmtDate(p.expiresAt)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-neutral-100">
          <Link
            href="/buy"
            className="inline-flex items-center gap-1 text-sm font-medium text-turquoise-700 hover:text-turquoise-900"
          >
            Buy {totalPasses === 0 ? 'a pass' : 'more'}
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Invoices */}
      <section className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
              <Receipt size={20} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                Billing history
              </p>
              <p className="font-heading text-xl mb-1">
                Invoices &amp; receipts
              </p>
              <p className="text-sm text-neutral-600">
                Every payment you&apos;ve made.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-neutral-100">
          <Link
            href="/dashboard/invoices"
            className="inline-flex items-center gap-1 text-sm font-medium text-turquoise-700 hover:text-turquoise-900"
          >
            View invoices
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
            <ScanLine size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
              Check-in history
            </p>
            {visits.length === 0 ? (
              <>
                <p className="font-heading text-xl mb-1">No visits yet</p>
                <p className="text-sm text-neutral-600">
                  Your check-ins at the kiosk or front desk will show up here.
                </p>
              </>
            ) : (
              <>
                <p className="font-heading text-xl mb-1">
                  {visits.length} recent visit{visits.length === 1 ? '' : 's'}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {visits.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-baseline justify-between gap-3 py-1.5 border-b border-neutral-100 last:border-0"
                    >
                      <span className="text-neutral-800">
                        {fmtDateTime(v.checkedInAt)}
                      </span>
                      {v.checkedOutAt && (
                        <span className="text-xs text-neutral-500">
                          out {fmtDateTime(v.checkedOutAt)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </section>

      <p className="text-sm text-neutral-500">
        Need to change your name, phone, or company?{' '}
        <Link
          href="/dashboard/settings"
          className="text-turquoise-700 underline"
        >
          Edit in Settings
        </Link>
        .
      </p>
    </div>
  )
}
