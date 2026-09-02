'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { setMailStatus } from '@/app/dashboard/mail/actions'

interface Props {
  mailId: string
  currentStatus: string
}

export default function MailItemActions({ mailId, currentStatus }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const update = (status: string) => {
    setError(null)
    startTransition(async () => {
      const r = await setMailStatus(mailId, status)
      if (!r.ok) setError(r.error ?? 'Could not update')
    })
  }

  if (currentStatus === 'received') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => update('collected')}
        >
          Mark as collected
        </Button>
        <a
          href="mailto:team@theworx.io?subject=Mail%20forwarding%20request"
          className="text-xs text-neutral-500 underline"
        >
          Need this forwarded?
        </a>
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    )
  }
  return <p className="text-xs text-neutral-500 capitalize">{currentStatus}</p>
}
