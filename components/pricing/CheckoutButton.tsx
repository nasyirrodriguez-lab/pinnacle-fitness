'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  planSlug: string
  planName: string
  highlight: boolean
}

export default function CheckoutButton({ planSlug, planName, highlight }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push(`/auth?redirect=/pricing`)
      return
    }

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planSlug }),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong')
      setLoading(false)
      return
    }

    // Redirect to Stripe Checkout
    window.location.href = json.url
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`block w-full rounded-xl py-3 text-center text-sm font-bold transition-colors disabled:opacity-60 ${
          highlight
            ? 'bg-orange-500 text-white hover:bg-orange-400 shadow-lg shadow-orange-500/20'
            : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Redirecting…
          </span>
        ) : (
          `Join Now — ${planName}`
        )}
      </button>
      {error && <p className="mt-2 text-xs text-red-400 text-center">{error}</p>}
    </div>
  )
}
