'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  adminControlSubscription,
  adminSendRenewalReminder,
} from '@/app/admin/members/[id]/actions'

interface Props {
  userId: string
  subscriptionId: string
  status: string
  lapsed: boolean
}

type Action = 'pause' | 'cancel' | 'reactivate' | 'extend'

// Pause / cancel / reactivate for the membership shown in the Account
// card. Cancel asks for a second tap instead of a browser confirm.
export default function AdminSubscriptionControls({
  userId,
  subscriptionId,
  status,
  lapsed,
}: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [armCancel, setArmCancel] = useState(false)
  const [reminded, setReminded] = useState(false)
  const [isPending, startTransition] = useTransition()

  const remind = () => {
    setError(null)
    startTransition(async () => {
      const result = await adminSendRenewalReminder({ userId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setReminded(true)
    })
  }

  const run = (action: Action) => {
    setError(null)
    startTransition(async () => {
      const result = await adminControlSubscription({
        userId,
        subscriptionId,
        action,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setArmCancel(false)
      router.refresh()
    })
  }

  const btn =
    'px-2 py-1 text-xs font-medium border rounded-md disabled:opacity-50 '

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {(status === 'active' || status === 'past_due') && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run('extend')}
            className={
              btn +
              'border-turquoise-200 text-turquoise-800 hover:border-turquoise-400'
            }
          >
            Renew +1 month
          </button>
        )}
        {(status === 'active' || status === 'past_due') && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run('pause')}
            className={
              btn +
              'border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:border-neutral-400'
            }
          >
            Pause
          </button>
        )}
        {(status === 'paused' || lapsed) && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run('reactivate')}
            className={
              btn +
              'border-turquoise-200 text-turquoise-800 hover:border-turquoise-400'
            }
          >
            {lapsed && status !== 'paused'
              ? 'Reactivate (comp a month)'
              : 'Reactivate'}
          </button>
        )}
        <button
          type="button"
          disabled={isPending || reminded}
          onClick={remind}
          className={
            btn +
            'border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:border-neutral-400'
          }
        >
          {reminded ? 'Reminder sent' : 'Send pay reminder'}
        </button>
        {!armCancel ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setArmCancel(true)}
            className={
              btn +
              'border-neutral-200 text-neutral-600 hover:text-red-700 hover:border-red-300'
            }
          >
            Cancel…
          </button>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run('cancel')}
            className={btn + 'border-red-300 bg-red-50 text-red-700'}
          >
            {isPending ? 'Cancelling…' : 'Tap again to cancel membership'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
