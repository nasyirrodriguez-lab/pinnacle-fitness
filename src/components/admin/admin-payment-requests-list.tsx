'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  adminCancelPaymentRequest,
  adminEditPaymentRequest,
} from '@/app/admin/members/[id]/actions'
import { fmtAstDate } from '@/lib/time/ast'

export interface PendingRequestRow {
  id: string
  amountCents: number
  productLabel: string | null
  createdAt: string
}

export default function AdminPaymentRequestsList({
  requests,
}: {
  requests: PendingRequestRow[]
}) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (requests.length === 0) return null

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) {
        setError(r.error ?? 'Something went wrong')
        return
      }
      setEditingId(null)
      router.refresh()
    })
  }

  return (
    <div className="mt-4 border-t border-neutral-100 pt-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
        Outstanding requests
      </p>
      <ul className="space-y-2">
        {requests.map((r) => (
          <li
            key={r.id}
            className="bg-orange-50 border border-orange-200 rounded-md px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm">
                <strong>TTD ${(r.amountCents / 100).toFixed(0)}</strong>
                {r.productLabel && ` · ${r.productLabel}`}
                <span className="text-neutral-500">
                  {' '}
                  · sent {fmtAstDate(r.createdAt)}
                </span>
              </span>
              <span className="flex gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setEditingId(editingId === r.id ? null : r.id)
                    setAmount((r.amountCents / 100).toFixed(0))
                  }}
                  className="px-2 py-1 text-xs font-medium border border-neutral-300 bg-white rounded hover:bg-neutral-50"
                >
                  Edit amount
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    run(() => adminCancelPaymentRequest({ paymentId: r.id }))
                  }
                  className="px-2 py-1 text-xs font-medium text-red-700 rounded hover:bg-white"
                >
                  Cancel request
                </button>
              </span>
            </div>
            {editingId === r.id && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-28 h-8"
                />
                <button
                  type="button"
                  disabled={
                    isPending ||
                    !Number.isFinite(Number(amount)) ||
                    Number(amount) < 1
                  }
                  onClick={() =>
                    run(() =>
                      adminEditPaymentRequest({
                        paymentId: r.id,
                        amountCents: Math.round(Number(amount) * 100),
                      })
                    )
                  }
                  className="px-2.5 py-1.5 text-xs font-medium bg-darkBlue-900 text-white rounded hover:bg-darkBlue-800 disabled:opacity-50"
                >
                  {isPending ? 'Saving…' : 'Save + re-send link'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
    </div>
  )
}
