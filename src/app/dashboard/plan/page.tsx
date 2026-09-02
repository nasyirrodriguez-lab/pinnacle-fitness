import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createAdminClient } from '@/utils/supabase/admin'
import { memberAccess } from '@/lib/gym/entitlement'
import { listLedger, type LedgerEntry } from '@/lib/sessions/ledger'
import { fmtAstDate } from '@/lib/time/ast'
import PlanChangeRequest from '@/components/dashboard/plan-change-request'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Plan — Pinnacle Fitness',
  robots: { index: false, follow: false },
}

interface PackRow {
  id: string
  name: string
  usesRemaining: number
  usesTotal: number
  expiresAt: string
  sessionKind: 'pt' | 'open_gym'
}

async function loadPacks(userId: string): Promise<PackRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('pass_purchases')
    .select(
      'id, uses_total, uses_remaining, expires_at, passes(name, session_kind)'
    )
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
    const raw = r.passes as
      | { name?: string; session_kind?: string }
      | { name?: string; session_kind?: string }[]
      | null
    const p = Array.isArray(raw) ? (raw[0] ?? null) : raw
    return {
      id: r.id as string,
      name: p?.name ?? 'Pack',
      usesRemaining: r.uses_remaining as number,
      usesTotal: r.uses_total as number,
      expiresAt: r.expires_at as string,
      sessionKind: (p?.session_kind as 'pt' | 'open_gym') ?? 'pt',
    }
  })
}

const REASON_LABEL: Record<LedgerEntry['reason'], string> = {
  plan_grant: 'plan month',
  pack_purchase: 'pack',
  booking_use: 'booked',
  checkin_use: 'session',
  no_show: 'no-show',
  late_cancel: 'late cancel',
  refund: 'refund',
  expiry: 'expired',
  admin_adjust: 'adjusted by the team',
}

export default async function PlanPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  const admin = createAdminClient()
  const [access, packs, ledger] = await Promise.all([
    memberAccess(admin, user.id),
    loadPacks(user.id),
    listLedger(admin, user.id, 25),
  ])
  const plan = access.plan

  return (
    <div className="max-w-xl">
      <h1 className="heading-display text-4xl mb-6">Your plan</h1>

      <section className="rounded-lg bg-card border border-border p-5 mb-4">
        {plan ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] tracking-[0.15em] uppercase text-ice-mute mb-1">
                  Membership
                </p>
                <p className="font-heading text-2xl">{plan.name}</p>
              </div>
              <StatusChip status={access.subscriptionStatus} />
            </div>
            <dl className="grid grid-cols-2 gap-4 mt-5 text-sm">
              <div>
                <dt className="text-xs text-ice-mute">PT sessions</dt>
                <dd className="font-medium">
                  {plan.ptSessionsPerMonth === null
                    ? 'Unlimited'
                    : plan.ptSessionsPerMonth === 0
                      ? 'Not included'
                      : `${plan.ptSessionsPerMonth} / month`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ice-mute">Open gym</dt>
                <dd className="font-medium">
                  {plan.includesOpenGym
                    ? 'Included'
                    : plan.openGymVisitsPerMonth
                      ? `${plan.openGymVisitsPerMonth} visits / month`
                      : 'Not included'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ice-mute">
                  {access.subscriptionStatus === 'active' ? 'Renews' : 'Was due'}
                </dt>
                <dd className="font-medium">
                  {access.periodEnd ? fmtAstDate(access.periodEnd) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ice-mute">Resets</dt>
                <dd className="font-medium">Every month, no rollover</dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <p className="font-heading text-2xl mb-1">No membership yet</p>
            <p className="text-sm text-ice-dim">
              Pick a monthly plan for the best per-session price, or buy a pack
              if you want flexibility.
            </p>
          </>
        )}
        <div className="flex flex-wrap gap-2 mt-5">
          {plan && access.subscriptionStatus !== 'active' && (
            <Link
              href={`/subscribe/${plan.id}`}
              className="h-11 px-5 rounded-full bg-primary text-primary-foreground font-heading text-sm inline-flex items-center"
            >
              Renew now
            </Link>
          )}
          <Link
            href="/buy"
            className="h-11 px-5 rounded-full border border-ice text-ice font-heading text-sm inline-flex items-center"
          >
            {plan ? 'Buy a pack' : 'Choose a plan'}
          </Link>
          {plan && (
            <Link
              href="/pricing"
              className="h-11 px-5 rounded-full border border-border text-ice-dim font-heading text-sm inline-flex items-center"
            >
              Change plan
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-lg bg-primary text-primary-foreground p-5 mb-4 grid grid-cols-2 gap-4">
        <div>
          <p className="font-stat text-4xl leading-none">
            {access.ptUnlimited ? '∞' : access.ptBalance}
          </p>
          <p className="text-[11px] tracking-[0.1em] uppercase opacity-75 mt-1.5">
            PT sessions left
          </p>
        </div>
        <div>
          <p className="font-stat text-4xl leading-none">
            {access.openGymUnlimited ? '∞' : access.openGymBalance}
          </p>
          <p className="text-[11px] tracking-[0.1em] uppercase opacity-75 mt-1.5">
            Open-gym visits left
          </p>
        </div>
      </section>

      {packs.length > 0 && (
        <section className="rounded-lg bg-card border border-border p-5 mb-4">
          <p className="text-[11px] tracking-[0.15em] uppercase text-ice-mute mb-3">
            Packs
          </p>
          <ul className="divide-y divide-border">
            {packs.map((p) => (
              <li
                key={p.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-ice-mute">
                    {p.sessionKind === 'pt' ? 'PT' : 'Open gym'} · expires{' '}
                    {fmtAstDate(p.expiresAt)}
                  </p>
                </div>
                <p className="font-stat text-xl text-turf">
                  {p.usesRemaining}
                  <span className="font-sans text-xs text-ice-mute">
                    /{p.usesTotal}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg bg-card border border-border p-5 mb-4">
        <p className="text-[11px] tracking-[0.15em] uppercase text-ice-mute mb-3">
          History
        </p>
        {ledger.length === 0 ? (
          <p className="text-sm text-ice-mute">
            Nothing yet — your first session will show up here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {ledger.map((e) => (
              <li
                key={e.id}
                className="py-2.5 flex items-center justify-between gap-3 text-sm"
              >
                <span>
                  <span
                    className={
                      e.delta > 0
                        ? 'font-stat text-lg text-turf mr-2'
                        : 'font-stat text-lg text-ice mr-2'
                    }
                  >
                    {e.delta > 0 ? `+${e.delta}` : e.delta}
                  </span>
                  {e.kind === 'pt' ? 'PT' : 'Open gym'} · {REASON_LABEL[e.reason]}
                </span>
                <span className="text-xs text-ice-mute">
                  {fmtAstDate(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PlanChangeRequest />
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'bg-turf/15 text-turf' },
    grace: { label: 'Renewal due', cls: 'bg-warn/15 text-warn' },
    lapsed: { label: 'Lapsed', cls: 'bg-bad/15 text-bad' },
    paused: { label: 'Paused', cls: 'bg-bronze-raised text-ice' },
    none: { label: 'None', cls: 'bg-bronze-raised text-ice' },
  }
  const m = map[status] ?? map.none
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  )
}
