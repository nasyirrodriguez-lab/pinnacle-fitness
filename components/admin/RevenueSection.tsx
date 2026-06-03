'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { Payment, PaymentStatus, MonthlyRevenue } from '@/lib/types'

const RevenueChart = dynamic(() => import('./RevenueChart'), { ssr: false })

const statusBadge: Record<PaymentStatus, string> = {
  paid: 'bg-green-500/15 text-green-400 border border-green-500/25',
  failed: 'bg-red-500/15 text-red-400 border border-red-500/25',
  refunded: 'bg-zinc-700 text-zinc-400',
}

const planBadge: Record<string, string> = {
  basic: 'bg-zinc-700 text-zinc-300',
  premium: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  elite: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
}

function buildMonthlyRevenue(payments: Payment[]): MonthlyRevenue[] {
  const map = new Map<string, MonthlyRevenue>()

  payments
    .filter((p) => p.status === 'paid')
    .forEach((p) => {
      const d = new Date(p.paid_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      const existing = map.get(key)
      if (existing) {
        existing.revenue += p.amount
        existing.count += 1
      } else {
        map.set(key, { month: label, revenue: p.amount, count: 1 })
      }
    })

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)   // last 12 months
    .map(([, v]) => ({ ...v, revenue: Math.round(v.revenue * 100) / 100 }))
}

export default function RevenueSection({ payments }: { payments: Payment[] }) {
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPlan, setFilterPlan] = useState<string>('all')

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const matchStatus = filterStatus === 'all' || p.status === filterStatus
      const matchPlan = filterPlan === 'all' || p.plan_type === filterPlan
      return matchStatus && matchPlan
    })
  }, [payments, filterStatus, filterPlan])

  const monthlyData = useMemo(() => buildMonthlyRevenue(payments), [payments])

  const totalPaid = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const totalFailed = payments.filter((p) => p.status === 'failed').reduce((s, p) => s + p.amount, 0)
  const thisMonth = useMemo(() => {
    const m = new Date().getMonth()
    const y = new Date().getFullYear()
    return payments
      .filter((p) => {
        const d = new Date(p.paid_at)
        return p.status === 'paid' && d.getMonth() === m && d.getFullYear() === y
      })
      .reduce((s, p) => s + p.amount, 0)
  }, [payments])

  const selectCls =
    'rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 focus:border-orange-500 focus:outline-none transition'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Revenue</h2>
        <p className="text-sm text-zinc-500 mt-0.5">All payment records and monthly trends</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'All-Time Collected', value: `$${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'text-green-400' },
          { label: 'This Month', value: `$${thisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'text-orange-400' },
          { label: 'Failed Charges', value: `$${totalFailed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'text-red-400' },
          { label: 'Transactions', value: payments.length, color: 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-5">Monthly Revenue (last 12 months)</h3>
        <RevenueChart data={monthlyData} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="all">All statuses</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} className={selectCls}>
          <option value="all">All plans</option>
          <option value="basic">Basic</option>
          <option value="premium">Premium</option>
          <option value="elite">Elite</option>
        </select>
        <span className="self-center text-xs text-zinc-600">{filtered.length} results</span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-600 text-sm">No payments match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/40">
                  {['Member', 'Plan', 'Amount', 'Date', 'Status', 'Invoice'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">{p.member_name}</p>
                      {p.payment_intent_id && (
                        <p className="text-xs text-zinc-600 font-mono mt-0.5 truncate max-w-[140px]">
                          {p.payment_intent_id}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${planBadge[p.plan_type]}`}>
                        {p.plan_type}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono font-semibold text-white">
                      ${p.amount.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-zinc-500 text-xs whitespace-nowrap">
                      {new Date(p.paid_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusBadge[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {p.invoice_url ? (
                        <a
                          href={p.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
