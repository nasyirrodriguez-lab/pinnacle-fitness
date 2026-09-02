'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { adminCancelBooking } from '@/app/admin/bookings/actions'

// Two taps, no dialog. The second tap offers to waive the session for
// late cancellations (the coach's call).
export default function AdminCancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [arm, setArm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const run = (waiveSession: boolean) => {
    setError(null)
    startTransition(async () => {
      const r = await adminCancelBooking({ bookingId, waiveSession })
      if (!r.ok) { setError(r.error); return }
      router.refresh()
    })
  }
  if (!arm) {
    return (
      <button type="button" onClick={() => setArm(true)} className="text-xs text-neutral-500 hover:text-red-700">
        Cancel
      </button>
    )
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex gap-1">
        <button type="button" disabled={isPending} onClick={() => run(false)} className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
          Cancel · rules apply
        </button>
        <button type="button" disabled={isPending} onClick={() => run(true)} className="px-2 py-1 text-xs font-semibold rounded-full border border-neutral-300">
          Cancel · waive session
        </button>
        <button type="button" onClick={() => setArm(false)} className="px-2 py-1 text-xs text-neutral-500">Back</button>
      </span>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  )
}
