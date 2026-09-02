import Link from 'next/link'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { loadGymSettings } from '@/lib/gym/settings'
import { astMonthBounds, astMonthKey, coachDelivery, fmtTtd, shiftMonthKey } from '@/lib/members/earnings'
import ExpenseManager, { type ExpenseRow } from '@/components/admin/expense-manager'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Finance — Admin' }

interface PageProps { searchParams: Promise<{ month?: string }> }

function monthLabel(key: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Port_of_Spain', month: 'long', year: 'numeric' }).format(new Date(`${key}-15T12:00:00-04:00`))
}

async function loadMonth(monthKey: string) {
  const admin = createAdminClient()
  const { fromIso, toIso } = astMonthBounds(monthKey)
  const nextKey = shiftMonthKey(monthKey, 1)
  const quarterFrom = astMonthBounds(shiftMonthKey(monthKey, -2)).fromIso
  const yearFrom = astMonthBounds(shiftMonthKey(monthKey, -11)).fromIso

  const [
    settings, { data: payments }, nasyir, matthew, { data: sales }, { data: pool },
    { data: oneOff }, { data: recurring }, { count: newMembers }, { data: subs },
    { data: monthVisits }, { data: quarterVisits }, { data: yearVisits }, { data: members },
  ] = await Promise.all([
    loadGymSettings(admin),
    admin.from('payments').select('amount_cents, kind, metadata, user_id, paid_at').eq('status', 'succeeded').gte('paid_at', fromIso).lt('paid_at', toIso).limit(5000),
    coachDelivery(admin, { resourceId: 'pt-nasyir', fromIso, toIso }),
    coachDelivery(admin, { resourceId: 'pt-matthew', fromIso, toIso }),
    admin.from('sales').select('total_cents').gte('created_at', fromIso).lt('created_at', toIso),
    admin.from('pool_contributions').select('amount_cents, coach_id, coaches(display_name)').eq('month', `${monthKey}-01`),
    admin.from('expenses').select('*').eq('is_recurring', false).gte('incurred_on', `${monthKey}-01`).lt('incurred_on', `${nextKey}-01`),
    admin.from('expenses').select('*').eq('is_recurring', true).lt('starts_on', `${nextKey}-01`).or(`ends_on.is.null,ends_on.gte.${monthKey}-01`),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'member').gte('created_at', fromIso).lt('created_at', toIso),
    admin.from('subscriptions').select('user_id, status, current_period_end, plans(name)').in('status', ['active', 'past_due', 'paused']).lte('started_at', toIso).gte('current_period_end', fromIso),
    admin.from('visits').select('user_id, checked_in_at').not('user_id', 'is', null).in('kind', ['pt', 'open_gym', 'member']).gte('checked_in_at', fromIso).lt('checked_in_at', toIso).limit(10000),
    admin.from('visits').select('user_id').not('user_id', 'is', null).gte('checked_in_at', quarterFrom).lt('checked_in_at', toIso).limit(10000),
    admin.from('visits').select('user_id').not('user_id', 'is', null).gte('checked_in_at', yearFrom).lt('checked_in_at', toIso).limit(10000),
    admin.from('profiles').select('id').eq('role', 'member').eq('archived', false),
  ])

  type Pay = { amount_cents: number; kind: string; metadata: Record<string, unknown> | null; user_id: string | null }
  const pays = (payments as Pay[] | null) ?? []
  const collected = pays.reduce((s, p) => s + p.amount_cents, 0)
  const isOpenGym = (p: Pay) => {
    const m = p.metadata ?? {}
    return (typeof m.passId === 'string' && m.passId.startsWith('og-')) || (typeof m.planId === 'string' && m.planId.startsWith('open-gym'))
  }
  const openGymCents = pays.filter(isOpenGym).reduce((s, p) => s + p.amount_cents, 0)
  const byProduct = new Map<string, { count: number; cents: number }>()
  for (const p of pays) {
    const m = p.metadata ?? {}
    const label = typeof m.planId === 'string' ? `Plan · ${m.planId}` : typeof m.passId === 'string' ? `Pack · ${m.passId}` : m.shop === true ? 'Shop' : `Other · ${p.kind}`
    const e = byProduct.get(label) ?? { count: 0, cents: 0 }
    e.count++; e.cents += p.amount_cents; byProduct.set(label, e)
  }
  const shopCents = ((sales as { total_cents: number }[] | null) ?? []).reduce((s, x) => s + x.total_cents, 0)
  const poolRows = ((pool as { amount_cents: number; coach_id: string; coaches: { display_name?: string } | { display_name?: string }[] | null }[] | null) ?? [])
  const poolByCoach = new Map<string, number>()
  for (const r of poolRows) {
    const c = Array.isArray(r.coaches) ? (r.coaches[0] ?? null) : r.coaches
    const name = c?.display_name ?? 'Coach'
    poolByCoach.set(name, (poolByCoach.get(name) ?? 0) + r.amount_cents)
  }
  const poolContrib = poolRows.reduce((s, r) => s + r.amount_cents, 0)
  const poolTotal = openGymCents + shopCents + poolContrib

  const mapExpense = (r: Record<string, unknown>): ExpenseRow => ({
    id: r.id as string, label: r.label as string, category: r.category as string, amountCents: r.amount_cents as number,
    isRecurring: (r.is_recurring as boolean) ?? false, incurredOn: (r.incurred_on as string | null) ?? null, startsOn: (r.starts_on as string | null) ?? null, endsOn: (r.ends_on as string | null) ?? null,
  })
  const expenses = [...((recurring as Record<string, unknown>[] | null) ?? []).map(mapExpense), ...((oneOff as Record<string, unknown>[] | null) ?? []).map(mapExpense)]
  const expenseTotal = expenses.reduce((s, e) => s + e.amountCents, 0)

  // Members
  type Sub = { user_id: string; status: string; current_period_end: string; plans: { name?: string } | { name?: string }[] | null }
  const planCounts = new Map<string, number>()
  let lapsed = 0
  const graceMs = settings.lapseGraceDays * 24 * 60 * 60 * 1000
  for (const s of (subs as Sub[] | null) ?? []) {
    const p = Array.isArray(s.plans) ? (s.plans[0] ?? null) : s.plans
    const name = p?.name ?? 'Plan'
    planCounts.set(name, (planCounts.get(name) ?? 0) + 1)
    if (Date.now() - new Date(s.current_period_end).getTime() > graceMs) lapsed++
  }
  const distinct = (rows: { user_id: string | null }[] | null) => new Set(((rows ?? []) as { user_id: string }[]).map((r) => r.user_id))
  const monthActive = distinct(monthVisits as { user_id: string }[] | null)
  const lastVisit = new Map<string, number>()
  for (const v of ((monthVisits ?? []) as { user_id: string; checked_in_at: string }[])) {
    const t = new Date(v.checked_in_at).getTime()
    if ((lastVisit.get(v.user_id) ?? 0) < t) lastVisit.set(v.user_id, t)
  }
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
  const memberIds = ((members as { id: string }[] | null) ?? []).map((m) => m.id)
  const atRisk = monthKey === astMonthKey() ? memberIds.filter((id) => (lastVisit.get(id) ?? 0) < cutoff).length : null

  // Floor: check-ins by hour + hours the cap was hit
  const byHour = new Array<number>(24).fill(0)
  for (const v of ((monthVisits ?? []) as { checked_in_at: string }[])) {
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Port_of_Spain', hour: 'numeric', hour12: false }).format(new Date(v.checked_in_at)))
    if (h >= 0 && h < 24) byHour[h]++
  }

  return {
    collected, delivered: nasyir.totalCents + matthew.totalCents, nasyir, matthew, openGymCents, shopCents, poolContrib, poolTotal, poolByCoach,
    rentTarget: settings.rentTargetCents, expenses, expenseTotal, byProduct: [...byProduct.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.cents - a.cents),
    newMembers: newMembers ?? 0, planCounts: [...planCounts.entries()].sort((a, b) => b[1] - a[1]), lapsed, atRisk,
    monthActive: monthActive.size, quarterActive: distinct(quarterVisits as { user_id: string }[] | null).size, yearActive: distinct(yearVisits as { user_id: string }[] | null).size,
    byHour, floorCap: settings.floorCap,
  }
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'turf' | 'warn' | 'bad' }) {
  const cls = tone === 'turf' ? 'bg-turquoise-500 text-black' : tone === 'warn' ? 'bg-orange-50 border border-orange-200' : tone === 'bad' ? 'bg-red-50 border border-red-200' : 'bg-white border border-neutral-200'
  return (
    <div className={`${cls} rounded-lg p-5`}>
      <p className="text-xs uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="font-stat text-3xl">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  )
}

export default async function AdminFinancePage({ searchParams }: PageProps) {
  const { month } = await searchParams
  const current = astMonthKey()
  const monthKey = /^\d{4}-\d{2}$/.test(month ?? '') ? month! : current
  const d = await loadMonth(monthKey)
  const profit = d.collected - d.expenseTotal
  const poolShort = d.rentTarget > 0 ? d.rentTarget - d.poolTotal : null
  const maxHour = Math.max(1, ...d.byHour)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="font-heading text-3xl mb-1">Finance</h1><p className="text-neutral-600 max-w-2xl">Collected, delivered, pooled, spent — and who was in. Any month.</p></div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/finance?month=${shiftMonthKey(monthKey, -1)}`} className="p-2 border border-neutral-300 rounded-full"><ChevronLeft size={16} /></Link>
          <span className="font-heading text-lg min-w-40 text-center">{monthLabel(monthKey)}</span>
          {monthKey < current ? <Link href={`/admin/finance?month=${shiftMonthKey(monthKey, 1)}`} className="p-2 border border-neutral-300 rounded-full"><ChevronRight size={16} /></Link> : <span className="p-2 border border-neutral-200 rounded-full text-neutral-300"><ChevronRight size={16} /></span>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Collected" value={fmtTtd(d.collected)} sub="Wam + cash, everything" tone="turf" />
        <Stat label="Expenses" value={fmtTtd(d.expenseTotal)} />
        <div className={profit >= 0 ? 'bg-lime-100 rounded-lg p-5' : 'bg-red-50 border border-red-200 rounded-lg p-5'}>
          <p className="text-xs uppercase tracking-wide opacity-70 mb-1 flex items-center gap-1">{profit >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} Profit</p>
          <p className="font-stat text-3xl">{fmtTtd(profit)}</p>
        </div>
        <Stat label="New members" value={String(d.newMembers)} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Delivered · Nasyir" value={fmtTtd(d.nasyir.totalCents)} sub={`${d.nasyir.count} sessions`} />
        <Stat label="Delivered · Matthew" value={fmtTtd(d.matthew.totalCents)} sub={`${d.matthew.count} sessions`} />
        <Stat label="Open gym + shop" value={fmtTtd(d.openGymCents + d.shopCents)} sub={`open gym ${fmtTtd(d.openGymCents)} · shop ${fmtTtd(d.shopCents)}`} />
        <Stat label="Rent pool" value={fmtTtd(d.poolTotal)} sub={poolShort === null ? 'no target set' : poolShort <= 0 ? `covered · target ${fmtTtd(d.rentTarget)}` : `short by ${fmtTtd(poolShort)} of ${fmtTtd(d.rentTarget)}`} tone={poolShort === null ? undefined : poolShort <= 0 ? 'turf' : 'warn'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mb-6">
        <section className="bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="font-heading text-lg mb-1">Expenses</h2>
          <p className="text-xs text-neutral-500 mb-4">One-offs land in the month you pick; fixed monthly costs count every month they run.</p>
          <ExpenseManager expenses={d.expenses} monthKey={monthKey} />
        </section>
        <div className="space-y-6">
          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-3">Pool, by source</h2>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Open gym</span><span className="font-stat">{fmtTtd(d.openGymCents)}</span></li>
              <li className="flex justify-between"><span>Shop</span><span className="font-stat">{fmtTtd(d.shopCents)}</span></li>
              {[...d.poolByCoach.entries()].map(([name, cents]) => <li key={name} className="flex justify-between"><span>{name} put in</span><span className="font-stat">{fmtTtd(cents)}</span></li>)}
              <li className="flex justify-between border-t border-neutral-100 pt-1.5 font-medium"><span>Total</span><span className="font-stat">{fmtTtd(d.poolTotal)}</span></li>
            </ul>
          </section>
          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-1">What sold</h2>
            {d.byProduct.length === 0 ? <p className="text-sm text-neutral-500">No paid revenue.</p> : (
              <ul className="space-y-1.5 text-sm">{d.byProduct.map((p) => <li key={p.label} className="flex justify-between"><span>{p.label} <span className="text-neutral-500">× {p.count}</span></span><span className="font-stat">{fmtTtd(p.cents)}</span></li>)}</ul>
            )}
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="font-heading text-lg mb-3">Members</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat label="Active this month" value={String(d.monthActive)} />
            <Stat label="Last 3 months" value={String(d.quarterActive)} />
            <Stat label="Last 12 months" value={String(d.yearActive)} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat label="Lapsed" value={String(d.lapsed)} sub="past renewal + grace" tone={d.lapsed > 0 ? 'bad' : undefined} />
            <Stat label="At risk" value={d.atRisk === null ? '—' : String(d.atRisk)} sub="no visit in 14 days" tone={d.atRisk && d.atRisk > 0 ? 'warn' : undefined} />
          </div>
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Live memberships</p>
          <ul className="space-y-1 text-sm">{d.planCounts.map(([name, n]) => <li key={name} className="flex justify-between"><span>{name}</span><span className="font-stat">{n}</span></li>)}</ul>
        </section>
        <section className="bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="font-heading text-lg mb-1">Floor by hour</h2>
          <p className="text-xs text-neutral-500 mb-4">Check-ins per hour of day this month. Cap is {d.floorCap}.</p>
          <div className="flex items-end gap-1 h-32">
            {d.byHour.map((n, h) => (
              <div key={h} className="flex-1 flex flex-col items-center gap-1" title={`${h}:00 · ${n}`}>
                <div className="w-full bg-turquoise-500 rounded-t" style={{ height: `${Math.round((n / maxHour) * 100)}%`, minHeight: n > 0 ? 3 : 0 }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-neutral-500 mt-1"><span>5 AM</span><span>noon</span><span>7 PM</span></div>
        </section>
      </div>
    </div>
  )
}
