'use client'

import { useState, useMemo } from 'react'
import type { Member } from '@/lib/types'
import MemberModal from './MemberModal'

const planBadge: Record<string, string> = {
  basic: 'bg-zinc-700 text-zinc-300',
  premium: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  elite: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
}

export default function MembersSection({ initialMembers }: { initialMembers: Member[] }) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [query, setQuery] = useState('')
  const [filterPlan, setFilterPlan] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selected, setSelected] = useState<Member | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return members.filter((m) => {
      const matchQ = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.member_code.toLowerCase().includes(q)
      const matchPlan = filterPlan === 'all' || m.plan_type === filterPlan
      const matchStatus = filterStatus === 'all' || (m.status ?? 'active') === filterStatus
      return matchQ && matchPlan && matchStatus
    })
  }, [members, query, filterPlan, filterStatus])

  function handleSaved(updated: Member) {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
    setSelected(updated)
  }

  const selectCls = 'rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 focus:border-orange-500 focus:outline-none transition'

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Members</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{members.length} total · {filtered.length} shown</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or member ID…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition"
          />
        </div>
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} className={selectCls}>
          <option value="all">All plans</option>
          <option value="basic">Basic</option>
          <option value="premium">Premium</option>
          <option value="elite">Elite</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-600 text-sm">No members match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/40">
                  {['Member', 'Email', 'Plan', 'Status', 'Joined', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((m) => {
                  const memberStatus = m.status ?? 'active'
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-zinc-800/50 cursor-pointer transition-colors"
                      onClick={() => setSelected(m)}
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{m.name}</p>
                        <p className="text-xs text-orange-400 font-mono mt-0.5">{m.member_code}</p>
                      </td>
                      <td className="px-5 py-4 text-zinc-400 text-xs">{m.email}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${planBadge[m.plan_type]}`}>
                          {m.plan_type}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`flex items-center gap-1.5 text-xs font-medium ${memberStatus === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${memberStatus === 'active' ? 'bg-green-400' : 'bg-red-400'}`} />
                          {memberStatus}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-zinc-500 text-xs whitespace-nowrap">
                        {new Date(m.join_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-zinc-600 hover:text-zinc-300 transition">Edit →</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <MemberModal
          member={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
