import Link from 'next/link'
import { Coins, Plus } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { cn } from '@/lib/utils'
import { fmtAstDate } from '@/lib/time/ast'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Credits — Admin',
}

interface GrantRow {
  id: string
  amountCents: number
  currency: string
  reason: string
  reasonNote: string | null
  expiresAt: string
  recipientEmail: string | null
  attachedAt: string | null
  createdAt: string
  user: { id: string; name: string | null; email: string | null } | null
}

interface LedgerRow {
  id: string
  amountCents: number
  balanceAfterCents: number
  reason: string
  createdAt: string
  user: { id: string; name: string | null; email: string | null } | null
}

async function loadGrants(): Promise<GrantRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('credit_grants')
    .select(
      'id, amount_cents, currency, reason, reason_note, expires_at, recipient_email, attached_at, created_at, user_id, profiles!credit_grants_user_id_fkey(id, full_name, email)'
    )
    .order('created_at', { ascending: false })
    .limit(100)
  if (!data) return []
  return (data as Record<string, unknown>[]).map((raw) => {
    const profileRaw = raw.profiles as
      | { id?: string; full_name?: string; email?: string }
      | { id?: string; full_name?: string; email?: string }[]
      | null
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
    return {
      id: raw.id as string,
      amountCents: raw.amount_cents as number,
      currency: (raw.currency as string) ?? 'TTD',
      reason: raw.reason as string,
      reasonNote: (raw.reason_note as string | null) ?? null,
      expiresAt: raw.expires_at as string,
      recipientEmail: (raw.recipient_email as string | null) ?? null,
      attachedAt: (raw.attached_at as string | null) ?? null,
      createdAt: raw.created_at as string,
      user: profile?.id
        ? {
            id: profile.id,
            name: profile.full_name ?? null,
            email: profile.email ?? null,
          }
        : null,
    }
  })
}

async function loadRecentLedger(): Promise<LedgerRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('credit_ledger')
    .select(
      'id, amount_cents, balance_after_cents, reason, created_at, user_id, profiles!credit_ledger_user_id_fkey(id, full_name, email)'
    )
    .order('created_at', { ascending: false })
    .limit(50)
  if (!data) return []
  return (data as Record<string, unknown>[]).map((raw) => {
    const profileRaw = raw.profiles as
      | { id?: string; full_name?: string; email?: string }
      | { id?: string; full_name?: string; email?: string }[]
      | null
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
    return {
      id: raw.id as string,
      amountCents: raw.amount_cents as number,
      balanceAfterCents: raw.balance_after_cents as number,
      reason: raw.reason as string,
      createdAt: raw.created_at as string,
      user: profile?.id
        ? {
            id: profile.id,
            name: profile.full_name ?? null,
            email: profile.email ?? null,
          }
        : null,
    }
  })
}

interface HolderRow {
  userId: string
  name: string
  balanceCents: number
}

async function loadTotals(): Promise<{
  outstandingCents: number
  unclaimedCents: number
  redeemedCents: number
  holders: HolderRow[]
}> {
  const admin = createAdminClient()

  // Outstanding = sum of latest balance_after_cents per user across active members.
  // Cheap-enough approximation: sum balance_after_cents of the most recent row
  // per user — Postgres views would be cleaner but for our scale we just pull.
  const { data: ledger } = await admin
    .from('credit_ledger')
    .select('user_id, balance_after_cents, created_at')
    .order('created_at', { ascending: false })
  let outstandingCents = 0
  const balances = new Map<string, number>()
  if (ledger) {
    for (const row of ledger as Array<{
      user_id: string
      balance_after_cents: number
    }>) {
      if (balances.has(row.user_id)) continue
      balances.set(row.user_id, row.balance_after_cents)
      outstandingCents += row.balance_after_cents
    }
  }

  // Who's holding credit right now — with names, biggest first.
  const holderIds = [...balances.entries()]
    .filter(([, cents]) => cents > 0)
    .map(([id]) => id)
  let holders: HolderRow[] = []
  if (holderIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', holderIds)
    const names = new Map(
      (
        (profiles as Array<{
          id: string
          full_name: string | null
          email: string
        }> | null) ?? []
      ).map((p) => [p.id, p.full_name?.trim() || p.email])
    )
    holders = holderIds
      .map((id) => ({
        userId: id,
        name: names.get(id) ?? 'Member',
        balanceCents: balances.get(id) ?? 0,
      }))
      .sort((a, b) => b.balanceCents - a.balanceCents)
  }

  // Unclaimed = sum of credit_grants with no attached_at + still in future.
  const { data: unclaimed } = await admin
    .from('credit_grants')
    .select('amount_cents')
    .is('attached_at', null)
    .gte('expires_at', new Date().toISOString())
  const unclaimedCents = (
    (unclaimed as Array<{ amount_cents: number }>) ?? []
  ).reduce((s, r) => s + r.amount_cents, 0)

  // Redeemed = sum of negative ledger rows (absolute value).
  const { data: debits } = await admin
    .from('credit_ledger')
    .select('amount_cents')
    .lt('amount_cents', 0)
  const redeemedCents = (
    (debits as Array<{ amount_cents: number }>) ?? []
  ).reduce((s, r) => s + Math.abs(r.amount_cents), 0)

  return { outstandingCents, unclaimedCents, redeemedCents, holders }
}

function fmtTtd(cents: number): string {
  return `TTD $${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

const fmtDate = fmtAstDate

const REASON_LABEL: Record<string, string> = {
  closure_compensation: 'Closure compensation',
  refund_as_credit: 'Refund',
  goodwill: 'Goodwill',
  referral: 'Referral',
  other: 'Other',
}

export default async function AdminCreditsPage() {
  const [grants, ledger, totals] = await Promise.all([
    loadGrants(),
    loadRecentLedger(),
    loadTotals(),
  ])

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl mb-1">Credits</h1>
          <p className="text-neutral-600 max-w-2xl">
            TTD account credit — refunds, goodwill, compensation. It spends
            itself: online checkout and room bookings use it automatically when
            it covers the full price, and the front desk can apply it to any
            payment via Record Payment. Issue it here in bulk, or straight from
            a member&apos;s page.
          </p>
        </div>
        <Link
          href="/admin/credits/issue"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-darkBlue-900 text-white rounded-md hover:bg-darkBlue-800"
        >
          <Plus size={16} />
          Issue credits
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Outstanding"
          value={fmtTtd(totals.outstandingCents)}
          hint="Total balance held by members today"
        />
        <StatCard
          label="Unclaimed"
          value={fmtTtd(totals.unclaimedCents)}
          hint="Held by email, not yet attached to a profile"
        />
        <StatCard
          label="Redeemed all-time"
          value={fmtTtd(totals.redeemedCents)}
          hint="Sum of every credit ever applied to a payment"
        />
      </div>

      {totals.holders.length > 0 && (
        <section className="mb-10">
          <h2 className="font-heading text-xl mb-3">
            Who&apos;s holding credit
          </h2>
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <ul className="divide-y divide-neutral-100">
              {totals.holders.map((h) => (
                <li key={h.userId}>
                  <Link
                    href={`/admin/members/${h.userId}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
                  >
                    <span className="text-sm font-medium">{h.name}</span>
                    <span className="text-sm font-heading">
                      {fmtTtd(h.balanceCents)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="font-heading text-xl mb-3">Recent grants</h2>
        {grants.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center text-neutral-500">
            <Coins
              size={28}
              className="mx-auto text-neutral-300 mb-2"
              strokeWidth={1.5}
            />
            No credits have been issued yet.
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {grants.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-3 text-sm">
                      {fmtDate(g.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {g.user ? (
                        <Link
                          href={`/admin/members/${g.user.id}`}
                          className="font-medium hover:text-darkBlue-900"
                        >
                          {g.user.name ?? g.user.email ?? '—'}
                        </Link>
                      ) : (
                        <span className="text-neutral-500 italic">
                          {g.recipientEmail ?? '—'}
                        </span>
                      )}
                      {g.reasonNote && (
                        <p className="text-xs text-neutral-500">
                          {g.reasonNote}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {REASON_LABEL[g.reason] ?? g.reason}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {fmtDate(g.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded',
                          g.attachedAt
                            ? 'bg-turquoise-100 text-turquoise-900'
                            : 'bg-neutral-100 text-neutral-700'
                        )}
                      >
                        {g.attachedAt ? 'Attached' : 'Unclaimed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      {fmtTtd(g.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-heading text-xl mb-3">Recent ledger activity</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-neutral-500">No ledger entries yet.</p>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">Change</th>
                  <th className="px-4 py-3 text-right">Balance after</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {ledger.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-sm">
                      {fmtDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {row.user ? (
                        <Link
                          href={`/admin/members/${row.user.id}`}
                          className="font-medium hover:text-darkBlue-900"
                        >
                          {row.user.name ?? row.user.email ?? '—'}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{row.reason}</td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right text-sm font-medium',
                        row.amountCents >= 0
                          ? 'text-turquoise-700'
                          : 'text-neutral-700'
                      )}
                    >
                      {row.amountCents >= 0 ? '+' : '−'}
                      {fmtTtd(Math.abs(row.amountCents))}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-neutral-600">
                      {fmtTtd(row.balanceAfterCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="font-heading text-2xl mb-1">{value}</p>
      <p className="text-xs text-neutral-500">{hint}</p>
    </div>
  )
}
