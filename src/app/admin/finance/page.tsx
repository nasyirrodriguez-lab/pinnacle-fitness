import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import ExpenseManager, {
  type ExpenseRow,
} from '@/components/admin/expense-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Finance — Admin',
}

interface PageProps {
  searchParams: Promise<{ month?: string }>
}

function astMonthKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Port_of_Spain',
    year: 'numeric',
    month: '2-digit',
  })
    .format(d)
    .slice(0, 7)
}

function monthLabel(key: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Port_of_Spain',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${key}-15T12:00:00-04:00`))
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function fmtTtd(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  return `${sign}TTD $${(Math.abs(cents) / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

interface MonthData {
  revenueCents: number
  revenueByKind: Map<string, { count: number; cents: number }>
  productSales: { label: string; count: number; cents: number }[]
  expenseTotalCents: number
  expenses: ExpenseRow[]
  newMembers: number
  monthlyActive: number
  quarterlyActive: number
  yearlyActive: number
  activeMembers: {
    name: string
    visitCount: number
    planName: string | null
    passLabels: string[]
  }[]
  activePlans: { planName: string; count: number }[]
}

async function loadMonth(monthKey: string): Promise<MonthData> {
  const admin = createAdminClient()
  const monthStart = new Date(`${monthKey}-01T00:00:00-04:00`)
  const nextMonthKey = shiftMonth(monthKey, 1)
  const monthEnd = new Date(`${nextMonthKey}-01T00:00:00-04:00`)
  const quarterStart = new Date(`${shiftMonth(monthKey, -2)}-01T00:00:00-04:00`)
  const yearStart = new Date(`${shiftMonth(monthKey, -11)}-01T00:00:00-04:00`)
  const monthEndDate = `${nextMonthKey}-01`

  const [
    { data: payments },
    { data: oneOffExpenses },
    { data: recurringExpenses },
    { count: newMembers },
    { data: monthVisits },
    { data: quarterVisits },
    { data: yearVisits },
    { data: subs },
  ] = await Promise.all([
    admin
      .from('payments')
      .select('amount_cents, kind, metadata, user_id')
      .eq('status', 'succeeded')
      .gte('paid_at', monthStart.toISOString())
      .lt('paid_at', monthEnd.toISOString())
      .limit(5000),
    admin
      .from('expenses')
      .select('*')
      .eq('is_recurring', false)
      .gte('incurred_on', `${monthKey}-01`)
      .lt('incurred_on', monthEndDate),
    admin
      .from('expenses')
      .select('*')
      .eq('is_recurring', true)
      .lt('starts_on', monthEndDate)
      .or(`ends_on.is.null,ends_on.gte.${monthKey}-01`),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString()),
    admin
      .from('visits')
      .select('user_id')
      .not('user_id', 'is', null)
      .gte('checked_in_at', monthStart.toISOString())
      .lt('checked_in_at', monthEnd.toISOString())
      .limit(10000),
    admin
      .from('visits')
      .select('user_id')
      .not('user_id', 'is', null)
      .gte('checked_in_at', quarterStart.toISOString())
      .lt('checked_in_at', monthEnd.toISOString())
      .limit(10000),
    admin
      .from('visits')
      .select('user_id')
      .not('user_id', 'is', null)
      .gte('checked_in_at', yearStart.toISOString())
      .lt('checked_in_at', monthEnd.toISOString())
      .limit(10000),
    admin
      .from('subscriptions')
      .select('user_id, plan_id, plans(name)')
      .in('status', ['active', 'past_due', 'paused'])
      .lte('started_at', monthEnd.toISOString())
      .gte('current_period_end', monthStart.toISOString()),
  ])

  // Revenue + what sold.
  type PaymentRow = {
    amount_cents: number
    kind: string
    metadata: Record<string, unknown> | null
    user_id: string | null
  }
  let revenueCents = 0
  const revenueByKind = new Map<string, { count: number; cents: number }>()
  const productMap = new Map<string, { count: number; cents: number }>()
  for (const p of (payments as PaymentRow[] | null) ?? []) {
    revenueCents += p.amount_cents
    const kindEntry = revenueByKind.get(p.kind) ?? { count: 0, cents: 0 }
    kindEntry.count += 1
    kindEntry.cents += p.amount_cents
    revenueByKind.set(p.kind, kindEntry)

    const metadata = p.metadata ?? {}
    const productLabel =
      (typeof metadata.planId === 'string' && `Plan: ${metadata.planId}`) ||
      (typeof metadata.passId === 'string' && `Pass: ${metadata.passId}`) ||
      (typeof metadata.resourceId === 'string' &&
        `Booking: ${metadata.resourceId}`) ||
      (p.kind === 'booking' && 'Booking: room') ||
      `Other: ${p.kind}`
    const prodEntry = productMap.get(productLabel) ?? { count: 0, cents: 0 }
    prodEntry.count += 1
    prodEntry.cents += p.amount_cents
    productMap.set(productLabel, prodEntry)
  }
  const productSales = [...productMap.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.count - a.count)

  // Expenses.
  const mapExpense = (r: Record<string, unknown>): ExpenseRow => ({
    id: r.id as string,
    label: r.label as string,
    category: r.category as string,
    amountCents: r.amount_cents as number,
    isRecurring: (r.is_recurring as boolean) ?? false,
    incurredOn: (r.incurred_on as string | null) ?? null,
    startsOn: (r.starts_on as string | null) ?? null,
    endsOn: (r.ends_on as string | null) ?? null,
  })
  const expenses = [
    ...((recurringExpenses as Record<string, unknown>[] | null) ?? []).map(
      mapExpense
    ),
    ...((oneOffExpenses as Record<string, unknown>[] | null) ?? []).map(
      mapExpense
    ),
  ]
  const expenseTotalCents = expenses.reduce((s, e) => s + e.amountCents, 0)

  // Actives.
  const distinct = (rows: { user_id: string | null }[] | null) =>
    new Set(((rows ?? []) as { user_id: string }[]).map((r) => r.user_id))
  const monthActiveSet = distinct(monthVisits as { user_id: string }[] | null)
  const visitCounts = new Map<string, number>()
  for (const v of (monthVisits ?? []) as { user_id: string }[]) {
    visitCounts.set(v.user_id, (visitCounts.get(v.user_id) ?? 0) + 1)
  }

  // Plans + passes for the active member list.
  type SubRow = {
    user_id: string
    plan_id: string
    plans: { name?: string } | { name?: string }[] | null
  }
  const planByUser = new Map<string, string>()
  const planCounts = new Map<string, number>()
  for (const s of (subs as SubRow[] | null) ?? []) {
    const planRaw = s.plans
    const plan = Array.isArray(planRaw) ? (planRaw[0] ?? null) : planRaw
    const name = plan?.name ?? s.plan_id
    planByUser.set(s.user_id, name)
    planCounts.set(name, (planCounts.get(name) ?? 0) + 1)
  }

  const passByUser = new Map<string, string[]>()
  for (const p of (payments as PaymentRow[] | null) ?? []) {
    const passId = p.metadata?.passId
    if (p.user_id && typeof passId === 'string') {
      const list = passByUser.get(p.user_id) ?? []
      list.push(passId)
      passByUser.set(p.user_id, list)
    }
  }

  const topActiveIds = [...monthActiveSet]
    .sort((a, b) => (visitCounts.get(b) ?? 0) - (visitCounts.get(a) ?? 0))
    .slice(0, 50)
  let activeMembers: MonthData['activeMembers'] = []
  if (topActiveIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', topActiveIds)
    const nameById = new Map(
      (
        (profiles as
          | { id: string; full_name: string | null; email: string }[]
          | null) ?? []
      ).map((p) => [p.id, p.full_name?.trim() || p.email])
    )
    activeMembers = topActiveIds.map((id) => ({
      name: nameById.get(id) ?? 'Member',
      visitCount: visitCounts.get(id) ?? 0,
      planName: planByUser.get(id) ?? null,
      passLabels: passByUser.get(id) ?? [],
    }))
  }

  return {
    revenueCents,
    revenueByKind,
    productSales,
    expenseTotalCents,
    expenses,
    newMembers: newMembers ?? 0,
    monthlyActive: monthActiveSet.size,
    quarterlyActive: distinct(quarterVisits as { user_id: string }[] | null)
      .size,
    yearlyActive: distinct(yearVisits as { user_id: string }[] | null).size,
    activeMembers,
    activePlans: [...planCounts.entries()]
      .map(([planName, count]) => ({ planName, count }))
      .sort((a, b) => b.count - a.count),
  }
}

const KIND_LABEL: Record<string, string> = {
  pass: 'Passes',
  subscription: 'Memberships',
  booking: 'Bookings',
  one_time: 'One-off',
}

export default async function AdminFinancePage({ searchParams }: PageProps) {
  const { month } = await searchParams
  const currentKey = astMonthKey()
  const monthKey = /^\d{4}-\d{2}$/.test(month ?? '') ? month! : currentKey
  const data = await loadMonth(monthKey)
  const profitCents = data.revenueCents - data.expenseTotalCents

  const prev = shiftMonth(monthKey, -1)
  const next = shiftMonth(monthKey, 1)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl mb-1">Finance</h1>
          <p className="text-neutral-600 max-w-2xl">
            Revenue, expenses, and profit for any month — plus member growth,
            what sold, and who was active.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/finance?month=${prev}`}
            className="p-2 border border-neutral-300 rounded-md hover:bg-neutral-50"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="font-heading text-lg min-w-40 text-center">
            {monthLabel(monthKey)}
          </span>
          {monthKey < currentKey ? (
            <Link
              href={`/admin/finance?month=${next}`}
              className="p-2 border border-neutral-300 rounded-md hover:bg-neutral-50"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </Link>
          ) : (
            <span className="p-2 border border-neutral-200 rounded-md text-neutral-300">
              <ChevronRight size={16} />
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Revenue" value={fmtTtd(data.revenueCents)} />
        <StatCard label="Expenses" value={fmtTtd(data.expenseTotalCents)} />
        <div
          className={
            profitCents >= 0
              ? 'bg-lime-50 border border-lime-200 rounded-lg p-5'
              : 'bg-red-50 border border-red-200 rounded-lg p-5'
          }
        >
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1 flex items-center gap-1">
            {profitCents >= 0 ? (
              <TrendingUp size={13} />
            ) : (
              <TrendingDown size={13} />
            )}
            Profit
          </p>
          <p className="font-heading text-2xl">{fmtTtd(profitCents)}</p>
        </div>
        <StatCard label="New members" value={String(data.newMembers)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mb-6">
        <section className="bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="font-heading text-lg mb-1">Expenses</h2>
          <p className="text-xs text-neutral-500 mb-4">
            One-off costs land in the month you pick; fixed monthly expenses
            count in every month they run.
          </p>
          <ExpenseManager expenses={data.expenses} monthKey={monthKey} />
        </section>

        <div className="space-y-6">
          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-3">Revenue breakdown</h2>
            {data.revenueByKind.size === 0 ? (
              <p className="text-sm text-neutral-500">
                No paid revenue this month.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {[...data.revenueByKind.entries()]
                  .sort((a, b) => b[1].cents - a[1].cents)
                  .map(([kind, v]) => (
                    <li
                      key={kind}
                      className="flex items-center justify-between"
                    >
                      <span>
                        {KIND_LABEL[kind] ?? kind}
                        <span className="text-neutral-500"> × {v.count}</span>
                      </span>
                      <span className="font-medium">{fmtTtd(v.cents)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-1">What sold</h2>
            <p className="text-xs text-neutral-500 mb-3">
              Most to least purchased this month.
            </p>
            {data.productSales.length === 0 ? (
              <p className="text-sm text-neutral-500">No purchases.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {data.productSales.map((p) => (
                  <li
                    key={p.label}
                    className="flex items-center justify-between"
                  >
                    <span>
                      {p.label}
                      <span className="text-neutral-500"> × {p.count}</span>
                    </span>
                    <span className="font-medium">{fmtTtd(p.cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="font-heading text-lg mb-1">Active members</h2>
          <p className="text-xs text-neutral-500 mb-4">
            Members who checked in at least once, ending {monthLabel(monthKey)}.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <MiniStat label="This month" value={data.monthlyActive} />
            <MiniStat label="Last 3 months" value={data.quarterlyActive} />
            <MiniStat label="Last 12 months" value={data.yearlyActive} />
          </div>
          {data.activePlans.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
                Live memberships in this month
              </p>
              <ul className="space-y-1 text-sm mb-4">
                {data.activePlans.map((p) => (
                  <li
                    key={p.planName}
                    className="flex items-center justify-between"
                  >
                    <span>{p.planName}</span>
                    <span className="font-medium">{p.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="font-heading text-lg">Who was in</h2>
            <p className="text-xs text-neutral-500">
              Check-ins this month, with their plan and any passes bought.
            </p>
          </div>
          {data.activeMembers.length === 0 ? (
            <p className="p-6 text-sm text-neutral-500">
              No member check-ins this month.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100 max-h-96 overflow-y-auto">
              {data.activeMembers.map((m, i) => (
                <li
                  key={i}
                  className="px-6 py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{m.name}</span>
                    <span className="block text-xs text-neutral-500 truncate">
                      {m.planName ?? 'No plan'}
                      {m.passLabels.length > 0 &&
                        ` · bought: ${m.passLabels.join(', ')}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-neutral-600">
                    {m.visitCount} visit{m.visitCount === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-5">
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
        {label}
      </p>
      <p className="font-heading text-2xl">{value}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded px-3 py-2">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="font-heading text-xl">{value}</p>
    </div>
  )
}
