'use client'

import { useState, useMemo } from 'react'
import type { Payment, PaymentStatus } from '@/lib/types'

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

  const totalPaid = filtered.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const totalFailed = filtered.filter((p) => p.status === 'failed').reduce((s, p) => s + p.amount, 0)

  const selectCls = 'rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 focus:border-orange-500 focus:outline-none transition'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Revenue</h2>
        <p className="text-sm text-zinc-500 mt-0.5">All payment records</p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Collected (filtered)</p>
          <p className="text-xl font-black text-green-400">${totalPaid.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Failed (filtered)</p>
          <p className="text-xl font-black text-red-400">${totalFailed.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Transactions</p>
          <p className="text-xl font-black text-white">{filtered.length}</p>
        </div>
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
                  {['Member', 'Plan', 'Amount', 'Date', 'Status'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-4 text-white font-medium">{p.member_name}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${planBadge[p.plan_type]}`}>
                        {p.plan_type}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono font-semibold text-white">
                      ${p.amount.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-zinc-500 text-xs whitespace-nowrap">
                      {new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusBadge[p.status]}`}>
                        {p.status}
                      </span>
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
