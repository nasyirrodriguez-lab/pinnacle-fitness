'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { adminSetPaymentDate } from '@/app/admin/payments/actions'

interface Props {
  paymentId: string
  dateLabel: string
  // Current paid_at (or created_at fallback) as ISO, for the input default.
  currentIso: string
}

// Click the date to correct it — for cash payments recorded late or any
// payment whose books-date needs backfilling.
export default function AdminPaymentDate({
  paymentId,
  dateLabel,
  currentIso,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(() => {
    // datetime-local wants local wall time without zone.
    const d = new Date(currentIso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const save = () => {
    setError(null)
    startTransition(async () => {
      const result = await adminSetPaymentDate({
        paymentId,
        paidAtIso: new Date(value).toISOString(),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-1.5 text-sm hover:text-darkBlue-900"
        title="Change payment date"
      >
        {dateLabel}
        <Pencil
          size={11}
          className="text-neutral-300 group-hover:text-neutral-600"
        />
      </button>
    )
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isPending}
          className="h-8 rounded-md border border-neutral-200 px-2 text-xs"
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending || !value}
          className="px-2 py-1 text-xs font-medium rounded-md bg-darkBlue-900 text-white disabled:opacity-50"
        >
          {isPending ? '…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={isPending}
          className="text-xs text-neutral-500 hover:text-neutral-900"
        >
          Cancel
        </button>
      </span>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  )
}
