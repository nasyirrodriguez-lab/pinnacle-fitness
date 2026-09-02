'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { adminSetMailStatus } from '@/app/admin/virtual-office/actions'

interface Props {
  mailId: string
  currentStatus: string
}

export default function AdminMailStatusActions({
  mailId,
  currentStatus,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const setStatus = (status: 'collected' | 'forwarded' | 'discarded') => {
    setError(null)
    startTransition(async () => {
      const r = await adminSetMailStatus({ mailId, status })
      if (!r.ok) setError(r.error ?? 'Failed')
    })
  }

  if (currentStatus !== 'received') {
    return (
      <span className="text-xs text-neutral-500 capitalize">
        {currentStatus}
      </span>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => setStatus('collected')}
      >
        Collected
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => setStatus('forwarded')}
      >
        Forwarded
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => setStatus('discarded')}
      >
        Discard
      </Button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
