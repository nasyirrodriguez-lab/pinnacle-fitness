'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminIssueCreditDirect } from '@/app/admin/members/[id]/actions'

// Put TTD credit straight on this member's account — no email claim.
export default function AdminDirectCreditForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const parsed = Number.parseFloat(amount)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await adminIssueCreditDirect({
        userId,
        amountCents: Math.round(parsed * 100),
        note: note.trim() || undefined,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setAmount('')
      setNote('')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          min={1}
          step={1}
          placeholder="Amount (TTD $)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isPending}
          className="h-9"
        />
        <Input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isPending}
          maxLength={300}
          className="h-9"
        />
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={isPending || !Number.isFinite(parsed) || parsed <= 0}
      >
        {isPending ? 'Issuing…' : 'Add credit to this account'}
      </Button>
    </form>
  )
}
