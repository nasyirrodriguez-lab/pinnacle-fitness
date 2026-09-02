'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  issueInfluencerPassBatch,
  type InfluencerBatchResult,
} from '@/app/admin/passes/influencer-batch/actions'

interface Props {
  defaultExpiry: string
  defaultNote: string
}

export default function InfluencerBatchForm({
  defaultExpiry,
  defaultNote,
}: Props) {
  const [emailsRaw, setEmailsRaw] = useState('')
  const [expiry, setExpiry] = useState(defaultExpiry)
  const [note, setNote] = useState(defaultNote)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<InfluencerBatchResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult(null)

    const emails = emailsRaw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0)
    const unique = Array.from(new Set(emails))

    if (unique.length === 0) {
      setError('Add at least one email.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      setError('Expiry must be a date like 2026-06-06.')
      return
    }

    startTransition(async () => {
      const r = await issueInfluencerPassBatch({
        expiresAtIso: expiry,
        emails: unique,
        note: note.trim() || undefined,
      })
      if (!r.ok) {
        setError(r.error ?? 'Could not issue passes.')
        return
      }
      setResult(r)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <Label htmlFor="emails">Recipient emails</Label>
        <Textarea
          id="emails"
          rows={6}
          value={emailsRaw}
          onChange={(e) => setEmailsRaw(e.target.value)}
          placeholder={'one@example.com\ntwo@example.com\nthree@example.com'}
          className="font-mono text-sm"
          disabled={isPending}
        />
        <p className="text-xs text-neutral-500 mt-1">
          One per line, or comma-separated. Up to 50. Recipients must already
          have a member profile.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="expiry">Expires on</Label>
          <Input
            id="expiry"
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            disabled={isPending}
          />
          <p className="text-xs text-neutral-500 mt-1">
            All passes minted in this batch will expire at end of day on this
            date.
          </p>
        </div>
        <div>
          <Label htmlFor="note">Internal note</Label>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isPending}>
        <Sparkles size={16} className="mr-2" />
        {isPending ? 'Issuing passes…' : 'Issue passes to listed emails'}
      </Button>

      {result && (
        <div className="bg-white border border-neutral-200 rounded-md p-4 text-sm">
          <p className="font-medium mb-3">
            Processed {result.perEmail.length} email
            {result.perEmail.length === 1 ? '' : 's'}
          </p>
          <ul className="space-y-2">
            {result.perEmail.map((r) => (
              <li
                key={r.email}
                className="flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs truncate">{r.email}</p>
                  {r.note && (
                    <p className="text-xs text-neutral-500">{r.note}</p>
                  )}
                </div>
                <Outcome outcome={r.outcome} />
              </li>
            ))}
          </ul>
          {result.perEmail.some((r) => r.outcome === 'no_profile') && (
            <p className="mt-4 text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded px-3 py-2">
              Some emails didn&apos;t match a member profile. Ask those
              recipients to sign up at theworx.io/sign-up first, then re-run
              this batch with just those emails.
            </p>
          )}
        </div>
      )}
    </form>
  )
}

function Outcome({
  outcome,
}: {
  outcome: InfluencerBatchResult['perEmail'][number]['outcome']
}) {
  switch (outcome) {
    case 'granted':
      return (
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-turquoise-100 text-turquoise-800">
          <CheckCircle2 size={12} />
          Granted
        </span>
      )
    case 'already_has_active_pass':
      return (
        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
          Already has pass
        </span>
      )
    case 'no_profile':
      return (
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          <AlertCircle size={12} />
          No profile
        </span>
      )
    case 'payment_insert_failed':
    case 'pass_insert_failed':
      return (
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <AlertCircle size={12} />
          Error
        </span>
      )
  }
}
