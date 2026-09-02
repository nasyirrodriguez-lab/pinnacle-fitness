'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Cancel / reschedule for one upcoming PT booking, with the outcome
// spelled out before anything is committed.

interface Props {
  bookingId: string
  resourceId: string
  label: string
  outcome: 'free' | 'uses_session' | 'too_late'
  cancelHours: number
}

export default function BookingActions({
  bookingId,
  resourceId,
  label,
  outcome,
  cancelHours,
}: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (outcome === 'too_late') {
    return (
      <p className="text-xs text-muted-foreground">
        Started — talk to your coach if you can&apos;t make it.
      </p>
    )
  }

  const cancel = () => {
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        setError(data.message ?? 'Could not cancel.')
        return
      }
      setConfirming(false)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {confirming ? (
        <div className="bg-background border border-border rounded-[18px] p-3 text-sm max-w-xs">
          <p className="font-semibold mb-1">Cancel {label}?</p>
          <p className="text-muted-foreground text-xs mb-3">
            {outcome === 'free'
              ? `No charge — you're outside the ${cancelHours}-hour window.`
              : `Cancelling now uses the session — you're inside the ${cancelHours}-hour window.`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={cancel}
              className={
                outcome === 'free'
                  ? 'px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50'
                  : 'px-3 py-1.5 rounded-full bg-destructive text-background text-xs font-semibold disabled:opacity-50'
              }
            >
              {isPending
                ? 'Cancelling…'
                : outcome === 'free'
                  ? 'Yes, cancel'
                  : 'Cancel and use the session'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-muted-foreground"
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Link
            href={`/book/${resourceId}?reschedule=${bookingId}`}
            className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold hover:border-foreground"
          >
            Reschedule
          </Link>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
