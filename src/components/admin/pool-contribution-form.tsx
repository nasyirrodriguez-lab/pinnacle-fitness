'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { coachAddPoolContribution } from '@/app/coach/actions'

export default function PoolContributionForm({ defaultMonth }: { defaultMonth: string }) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState(defaultMonth)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-neutral-500">TT$<Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28" /></label>
      <label className="text-xs text-neutral-500">Month<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" /></label>
      <label className="text-xs text-neutral-500">Note<Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Rent share" maxLength={200} className="w-44" /></label>
      <Button
        type="button"
        size="sm"
        disabled={isPending || !Number.isFinite(Number(amount)) || Number(amount) <= 0}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const r = await coachAddPoolContribution({ amountCents: Math.round(Number(amount) * 100), month, note })
            if (!r.ok) { setError(r.error); return }
            setAmount(''); setNote('')
            router.refresh()
          })
        }}
      >
        {isPending ? 'Saving…' : 'Put into the pool'}
      </Button>
      {error && <p className="text-sm text-red-700 w-full">{error}</p>}
    </div>
  )
}
