'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  reconcilePendingWamPayments,
  type ReconcileResult,
} from '@/app/admin/payments/reconcile-action'

interface Props {
  pendingCount: number
}

export default function ReconcileButton({ pendingCount }: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ReconcileResult | null>(null)

  const run = () => {
    setResult(null)
    startTransition(async () => {
      const r = await reconcilePendingWamPayments()
      setResult(r)
    })
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={run}
        disabled={isPending || pendingCount === 0}
        title={
          pendingCount === 0 ? 'No pending payments to reconcile' : undefined
        }
      >
        <RefreshCw
          size={14}
          className={isPending ? 'mr-2 animate-spin' : 'mr-2'}
        />
        {isPending ? 'Checking Wam…' : `Check pending (${pendingCount})`}
      </Button>

      {result && !result.ok && (
        <p className="text-sm text-red-700 mt-3">
          {result.error ?? 'Reconcile failed'}
        </p>
      )}

      {result && result.ok && (
        <div className="mt-4 bg-white border border-neutral-200 rounded-md p-4 text-sm">
          <p className="font-medium mb-2">
            Scanned {result.scanned} pending payment
            {result.scanned === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Pill
              icon={<CheckCircle2 size={14} className="text-turquoise-600" />}
              label="Wam says paid"
              value={result.wamVerified}
            />
            <Pill
              icon={<XCircle size={14} className="text-red-600" />}
              label="Marked failed"
              value={result.failed}
            />
            <Pill
              icon={<Clock size={14} className="text-neutral-500" />}
              label="Still pending"
              value={result.stillPending}
            />
          </div>
          {result.wamVerified > 0 && (
            <p className="text-xs text-neutral-600 mb-3">
              Payments Wam reports as paid now show a &ldquo;Wam says paid —
              confirm&rdquo; button in the table below (refresh the page).
              Confirming grants the member their product.
            </p>
          )}
          {result.perPayment.some((p) => p.outcome === 'wam_error') && (
            <details className="text-xs text-neutral-700">
              <summary className="cursor-pointer text-neutral-500 hover:text-neutral-900">
                Show per-payment details
              </summary>
              <ul className="mt-2 space-y-1">
                {result.perPayment.map((p) => (
                  <li key={p.paymentId} className="font-mono">
                    {p.outcome}
                    {' · '}
                    <span className="text-neutral-500">
                      {p.paymentId.slice(0, 8)}
                    </span>
                    {p.note && (
                      <span className="text-neutral-500"> · {p.note}</span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.remainingAfter > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={run} disabled={isPending}>
                <RefreshCw
                  size={14}
                  className={isPending ? 'mr-2 animate-spin' : 'mr-2'}
                />
                {isPending
                  ? 'Checking Wam…'
                  : `Check next ${result.remainingAfter}`}
              </Button>
              <p className="text-xs text-neutral-500">
                Processed in batches of 10 to stay inside Vercel&apos;s function
                timeout.
              </p>
            </div>
          ) : (
            <p className="text-xs text-neutral-500 mt-3">
              Refresh the page to see updated statuses.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Pill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-0.5">
        {icon}
        {label}
      </div>
      <p className="font-heading text-xl">{value}</p>
    </div>
  )
}
