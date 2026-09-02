'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import {
  adminVerifyWamPayment,
  type VerifyWamResult,
} from '@/app/admin/payments/actions'

interface Props {
  paymentId: string
  wamReportsPaid: boolean
}

export default function AdminVerifyWamButton({
  paymentId,
  wamReportsPaid,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<VerifyWamResult | null>(null)

  const run = () => {
    setResult(null)
    startTransition(async () => {
      const r = await adminVerifyWamPayment({ paymentId })
      setResult(r)
      if (r.ok) router.refresh()
    })
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className={
          wamReportsPaid
            ? 'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-lime-100 text-lime-900 hover:bg-lime-200 disabled:opacity-50'
            : 'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50'
        }
        title="Checks this payment against Wam and confirms it only if Wam reports succeeded"
      >
        <ShieldCheck size={12} />
        {isPending
          ? 'Checking…'
          : wamReportsPaid
            ? 'Wam says paid — confirm'
            : 'Verify with Wam'}
      </button>
      {result && !result.ok && (
        <span className="text-xs text-red-700 max-w-48 text-right">
          {result.error}
        </span>
      )}
    </div>
  )
}
