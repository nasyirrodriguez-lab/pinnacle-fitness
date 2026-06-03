'use client'

import { useState } from 'react'
import type { Member, PlanType, MemberStatus } from '@/lib/types'

const planBadge: Record<string, string> = {
  basic: 'bg-zinc-700 text-zinc-300',
  premium: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  elite: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
}

interface Props {
  member: Member
  onClose: () => void
  onSaved: (updated: Member) => void
}

export default function MemberModal({ member, onClose, onSaved }: Props) {
  const [name, setName] = useState(member.name)
  const [planType, setPlanType] = useState<PlanType>(member.plan_type)
  const [status, setStatus] = useState<MemberStatus>(member.status ?? 'active')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmSuspend, setConfirmSuspend] = useState(false)

  async function save() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: member.id, name, plan_type: planType, status }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error ?? 'Save failed'); return }
    onSaved(json.member as Member)
  }

  async function toggleSuspend() {
    const next: MemberStatus = status === 'active' ? 'suspended' : 'active'
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: member.id, status: next }),
    })
    const json = await res.json()
    setSaving(false)
    setConfirmSuspend(false)
    if (!res.ok) { setError(json.error ?? 'Failed'); return }
    setStatus(next)
    onSaved(json.member as Member)
  }

  const joinDate = new Date(member.join_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{member.name}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${planBadge[member.plan_type]}`}>
                {member.plan_type}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">{member.email}</p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition p-1">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Read-only info strip */}
        <div className="grid grid-cols-3 gap-px bg-zinc-800 text-center text-xs">
          {[
            { label: 'Member ID', val: member.member_code, mono: true },
            { label: 'Joined', val: joinDate },
            { label: 'Status', val: status, color: status === 'active' ? 'text-green-400' : 'text-red-400' },
          ].map(({ label, val, mono, color }) => (
            <div key={label} className="bg-zinc-900 py-3 px-2">
              <p className="text-zinc-600 uppercase tracking-wide mb-1">{label}</p>
              <p className={`font-semibold ${mono ? 'font-mono text-orange-400' : color ?? 'text-zinc-300'}`}>{val}</p>
            </div>
          ))}
        </div>

        {/* Edit form */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Plan</label>
            <select
              value={planType}
              onChange={(e) => setPlanType(e.target.value as PlanType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition"
            >
              <option value="basic">Basic — $29/mo</option>
              <option value="premium">Premium — $59/mo</option>
              <option value="elite">Elite — $99/mo</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>

            {!confirmSuspend ? (
              <button
                onClick={() => setConfirmSuspend(true)}
                disabled={saving}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  status === 'active'
                    ? 'border-red-500/40 text-red-400 hover:bg-red-500/10'
                    : 'border-green-500/40 text-green-400 hover:bg-green-500/10'
                }`}
              >
                {status === 'active' ? 'Suspend' : 'Reinstate'}
              </button>
            ) : (
              <button
                onClick={toggleSuspend}
                disabled={saving}
                className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-60 transition-colors"
              >
                {saving ? '…' : 'Confirm'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
