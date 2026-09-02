'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { coachSettleSession } from '@/app/coach/actions'

export default function CoachSessionButtons({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (outcome: 'delivered' | 'no_show') => {
    setError(null)
    startTransition(async () => {
      const r = await coachSettleSession({ bookingId, outcome })
      if (!r.ok) {
        setError(r.error)
        return
      }
      router.refresh()
    })
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run('delivered')}
          className="px-3 py-1.5 text-xs font-semibold rounded-full bg-turquoise-500 text-black hover:bg-turquoise-600 disabled:opacity-50"
        >
          Delivered
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run('no_show')}
          className="px-3 py-1.5 text-xs font-semibold rounded-full border border-neutral-300 text-neutral-600 hover:text-red-700 hover:border-red-700 disabled:opacity-50"
        >
          No-show
        </button>
      </span>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  )
}
