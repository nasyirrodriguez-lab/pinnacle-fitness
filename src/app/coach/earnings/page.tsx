import Link from 'next/link'
import { requireCoach } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/utils/supabase/admin'
import { astMonthBounds, astMonthKey, coachDelivery, fmtTtd, shiftMonthKey } from '@/lib/members/earnings'
import { fmtAstDate } from '@/lib/time/ast'
import PoolContributionForm from '@/components/admin/pool-contribution-form'

export const metadata = { title: 'Earnings — Coach' }

function monthLabel(key: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Port_of_Spain', month: 'long', year: 'numeric' }).format(new Date(`${key}-15T12:00:00-04:00`))
}

export default async function CoachEarningsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const coach = await requireCoach()
  const { month } = await searchParams
  const current = astMonthKey()
  const monthKey = /^\d{4}-\d{2}$/.test(month ?? '') ? month! : current
  const admin = createAdminClient()
  const { data: coachRow } = await admin.from('coaches').select('slug').eq('id', coach.coachId).maybeSingle()
  const resourceId = `pt-${(coachRow as { slug: string } | null)?.slug ?? ''}`

  const thisMonth = astMonthBounds(monthKey)
  const lastMonth = astMonthBounds(shiftMonthKey(monthKey, -1))
  const [delivered, previous, { data: pool }, { data: owedRows }] = await Promise.all([
    coachDelivery(admin, { resourceId, ...thisMonth }),
    coachDelivery(admin, { resourceId, ...lastMonth }),
    admin.from('pool_contributions').select('id, amount_cents, month, note, created_at').eq('coach_id', coach.coachId).order('month', { ascending: false }).limit(24),
    // Sessions still owed: positive PT balances of people who train with me.
    admin.from('bookings').select('user_id').eq('resource_id', resourceId).gte('during', `[${lastMonth.fromIso},)`).limit(2000),
  ])

  const clientIds = [...new Set(((owedRows as { user_id: string | null }[] | null) ?? []).map((r) => r.user_id).filter((x): x is string => Boolean(x)))]
  let owed = 0
  if (clientIds.length > 0) {
    const { data: ledger } = await admin.from('session_ledger').select('user_id, delta').eq('kind', 'pt').in('user_id', clientIds)
    const by = new Map<string, number>()
    for (const r of (ledger as { user_id: string; delta: number }[] | null) ?? []) by.set(r.user_id, (by.get(r.user_id) ?? 0) + r.delta)
    for (const v of by.values()) if (v > 0) owed += v
  }

  const poolRows = ((pool as { id: string; amount_cents: number; month: string; note: string | null }[] | null) ?? [])
  const poolThisMonth = poolRows.filter((p) => p.month.startsWith(monthKey)).reduce((s, p) => s + p.amount_cents, 0)
  const trend = previous.totalCents === 0 ? null : Math.round(((delivered.totalCents - previous.totalCents) / previous.totalCents) * 100)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl mb-1">Earnings</h1>
          <p className="text-neutral-600 max-w-xl">What you&apos;ve delivered: every completed or no-show session × the per-session value of what that member bought.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/coach/earnings?month=${shiftMonthKey(monthKey, -1)}`} className="px-3 py-1.5 border border-neutral-300 rounded-full text-sm">←</Link>
          <span className="font-heading text-lg min-w-36 text-center">{monthLabel(monthKey)}</span>
          {monthKey < current ? (
            <Link href={`/coach/earnings?month=${shiftMonthKey(monthKey, 1)}`} className="px-3 py-1.5 border border-neutral-300 rounded-full text-sm">→</Link>
          ) : (
            <span className="px-3 py-1.5 border border-neutral-200 rounded-full text-sm text-neutral-300">→</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-turquoise-500 text-black rounded-lg p-5">
          <p className="text-xs uppercase tracking-wide opacity-70 mb-1">Delivered</p>
          <p className="font-stat text-3xl">{fmtTtd(delivered.totalCents)}</p>
          <p className="text-xs opacity-70 mt-1">{delivered.count} session{delivered.count === 1 ? '' : 's'}</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">vs last month</p>
          <p className="font-stat text-3xl">{trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend}%`}</p>
          <p className="text-xs text-neutral-500 mt-1">{fmtTtd(previous.totalCents)} · {previous.count} sessions</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Still owed</p>
          <p className="font-stat text-3xl">{owed}</p>
          <p className="text-xs text-neutral-500 mt-1">sessions your clients have paid for and not yet used</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Into the pool</p>
          <p className="font-stat text-3xl">{fmtTtd(poolThisMonth)}</p>
          <p className="text-xs text-neutral-500 mt-1">your rent share this month</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200"><h2 className="font-heading text-lg">Sessions this month</h2></div>
          {delivered.sessions.length === 0 ? (
            <p className="p-6 text-sm text-neutral-500">Nothing delivered yet this month.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 max-h-[32rem] overflow-y-auto">
              {delivered.sessions.map((s) => (
                <li key={s.bookingId} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium truncate block">{s.memberName}</span>
                    <span className="text-xs text-neutral-500">{fmtAstDate(s.startIso)}{s.status === 'no_show' && ' · no-show'}</span>
                  </span>
                  <span className="font-stat">{fmtTtd(s.cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="bg-white border border-neutral-200 rounded-lg p-5">
          <h2 className="font-heading text-lg mb-1">Rent pool</h2>
          <p className="text-xs text-neutral-500 mb-4">Open gym and the shop go into the pool automatically; log what you put in from your own earnings here.</p>
          <PoolContributionForm defaultMonth={current} />
          {poolRows.length > 0 && (
            <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100 text-sm">
              {poolRows.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                  <span>{monthLabel(p.month.slice(0, 7))}{p.note && <span className="text-neutral-500"> · {p.note}</span>}</span>
                  <span className="font-stat">{fmtTtd(p.amount_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
