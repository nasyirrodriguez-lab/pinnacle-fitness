'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { requestPlanChange } from '@/app/dashboard/plan/actions'

type Kind = 'pause' | 'deactivate' | 'reactivate'

const OPTIONS: { kind: Kind; label: string }[] = [
  { kind: 'pause', label: 'Pause' },
  { kind: 'deactivate', label: 'Deactivate' },
  { kind: 'reactivate', label: 'Reactivate' },
]

export default function PlanChangeRequest() {
  const [kind, setKind] = useState<Kind | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (sent) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <p className="font-medium mb-1">Request sent</p>
        <p className="text-sm text-neutral-600">
          The team has your request and will confirm with you. Questions in the
          meantime? Email{' '}
          <a
            href="mailto:team@theworx.io"
            className="text-turquoise-700 underline"
          >
            team@theworx.io
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6">
      <h3 className="font-heading text-lg mb-1">Change your membership</h3>
      <p className="text-sm text-neutral-600 mb-4">
        To request a pause, deactivation, or reactivation of your plan, pick an
        option below — it goes straight to the team. You can also email{' '}
        <a
          href="mailto:team@theworx.io"
          className="text-turquoise-700 underline"
        >
          team@theworx.io
        </a>
        .
      </p>
      <div className="inline-flex gap-1 p-1 bg-neutral-100 rounded-md mb-3">
        {OPTIONS.map((o) => (
          <button
            key={o.kind}
            type="button"
            onClick={() => setKind(o.kind)}
            className={
              kind === o.kind
                ? 'px-3 py-1.5 text-sm font-medium bg-white shadow-sm rounded'
                : 'px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 rounded'
            }
          >
            {o.label}
          </button>
        ))}
      </div>
      {kind && (
        <div className="space-y-3">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything the team should know? (optional)"
            maxLength={1000}
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button
            type="button"
            disabled={isPending}
            onClick={() => {
              setError(null)
              startTransition(async () => {
                const r = await requestPlanChange({ kind, note })
                if (!r.ok) {
                  setError(r.error)
                  return
                }
                setSent(true)
              })
            }}
          >
            {isPending ? 'Sending…' : `Request ${kind}`}
          </Button>
        </div>
      )}
    </div>
  )
}
