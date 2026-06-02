'use client'

import { useState } from 'react'

interface Props {
  periodEnd: string
  planSlug: string
}

export default function RenewBanner({ periodEnd, planSlug }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const daysLeft = Math.ceil(
    (new Date(periodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  if (daysLeft > 7 || daysLeft < 0) return null

  async function handleRenew() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planSlug }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed'); setLoading(false); return }
    window.location.href = json.url
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="text-amber-400 text-xl">⚡</span>
        <div>
          <p className="text-sm font-semibold text-amber-300">
            Membership expires {daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
          </p>
          <p className="text-xs text-amber-400/70 mt-0.5">
            Renew now to avoid losing access on{' '}
            {new Date(periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-start sm:items-end gap-1">
        <button
          onClick={handleRenew}
          disabled={loading}
          className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-white hover:bg-amber-400 disabled:opacity-60 transition-colors whitespace-nowrap"
        >
          {loading ? 'Loading…' : 'Renew Now →'}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  )
}
