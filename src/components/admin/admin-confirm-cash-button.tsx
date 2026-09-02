'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote } from 'lucide-react'
import { adminConfirmCashPayment } from '@/app/admin/payments/actions'

export default function AdminConfirmCashButton({
  paymentId,
  amountLabel,
}: {
  paymentId: string
  amountLabel: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    setError(null)
    startTransition(async () => {
      const r = await adminConfirmCashPayment({ paymentId })
      if (!r.ok) {
        setError(r.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      {confirming ? (
        <span className="inline-flex gap-1">
          <button
            type="button"
            disabled={isPending}
            onClick={run}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : `Got ${amountLabel} cash`}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirming(false)}
            className="px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900"
          >
            Back
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-900 hover:bg-green-200"
        >
          <Banknote size={12} />
          Cash at desk — confirm
        </button>
      )}
      {error && (
        <span className="text-xs text-red-700 max-w-48 text-right">
          {error}
        </span>
      )}
    </div>
  )
}
