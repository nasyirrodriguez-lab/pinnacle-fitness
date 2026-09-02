'use client'

import { useState, useTransition } from 'react'
import { Coins, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  issueCreditBatch,
  type IssueResult,
} from '@/app/admin/credits/issue/actions'

type Reason =
  | 'closure_compensation'
  | 'refund_as_credit'
  | 'goodwill'
  | 'referral'
  | 'other'

interface Props {
  defaultExpiry: string
  defaultReason: Reason
}

const REASON_LABEL: Record<Reason, string> = {
  closure_compensation: 'Closure compensation',
  refund_as_credit: 'Refund as credit',
  goodwill: 'Goodwill',
  referral: 'Referral reward',
  other: 'Other',
}

interface ParsedRow {
  email: string
  amountTtd: number
  note?: string
}

function parseRows(raw: string): {
  rows: ParsedRow[]
  errors: Array<{ line: number; message: string }>
} {
  const lines = raw.split(/\r?\n/)
  const rows: ParsedRow[] = []
  const errors: Array<{ line: number; message: string }> = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return
    if (trimmed.startsWith('#')) return // comments allowed

    const parts = trimmed.split(',').map((s) => s.trim())
    if (parts.length < 2) {
      errors.push({
        line: index + 1,
        message: 'Need at least email and amount',
      })
      return
    }
    const [email, amountRaw, ...rest] = parts
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errors.push({ line: index + 1, message: `Invalid email: ${email}` })
      return
    }
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ line: index + 1, message: `Invalid amount: ${amountRaw}` })
      return
    }
    rows.push({
      email: email.toLowerCase(),
      amountTtd: amount,
      note: rest.length > 0 ? rest.join(',').trim() : undefined,
    })
  })

  return { rows, errors }
}

export default function IssueCreditsForm({
  defaultExpiry,
  defaultReason,
}: Props) {
  const [raw, setRaw] = useState('')
  const [expiry, setExpiry] = useState(defaultExpiry)
  const [reason, setReason] = useState<Reason>(defaultReason)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<IssueResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const parsed = parseRows(raw)
  const previewTotal = parsed.rows.reduce((sum, r) => sum + r.amountTtd, 0)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult(null)

    if (parsed.rows.length === 0) {
      setError('Add at least one valid row.')
      return
    }
    if (parsed.errors.length > 0) {
      setError(
        `Fix the input first: ${parsed.errors.length} line${
          parsed.errors.length === 1 ? '' : 's'
        } invalid.`
      )
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      setError('Expiry must be a date like 2026-08-22.')
      return
    }

    startTransition(async () => {
      const r = await issueCreditBatch({
        expiresAtIso: expiry,
        reason,
        rows: parsed.rows,
      })
      if (!r.ok) {
        setError(r.error ?? 'Could not issue credits.')
        return
      }
      setResult(r)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <Label htmlFor="rows">Recipients</Label>
        <Textarea
          id="rows"
          rows={10}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={`# email, amount in TTD, optional note
mark@example.com, 2765, 12 Sessions + PT packs (PIN-0513)
nikolai@example.com, 2500, 6 Person Office 10 days lost`}
          className="font-mono text-sm"
          disabled={isPending}
        />
        <div className="flex items-center justify-between mt-1 text-xs text-neutral-500">
          <span>
            One row per recipient. Format:{' '}
            <code>email, amount, optional note</code>. Lines starting with{' '}
            <code>#</code> are ignored.
          </span>
          {parsed.rows.length > 0 && (
            <span>
              {parsed.rows.length} row{parsed.rows.length === 1 ? '' : 's'}
              {' · '}
              <strong>TTD ${previewTotal.toLocaleString('en-US')}</strong>
            </span>
          )}
        </div>
        {parsed.errors.length > 0 && (
          <ul className="mt-2 text-xs text-red-700 space-y-0.5">
            {parsed.errors.map((e, i) => (
              <li key={i}>
                Line {e.line}: {e.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="reason">Reason</Label>
          <Select value={reason} onValueChange={(v) => setReason(v as Reason)}>
            <SelectTrigger id="reason">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(REASON_LABEL) as Reason[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {REASON_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
            Defaults to 3 months from today.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isPending}>
        <Coins size={16} className="mr-2" />
        {isPending
          ? 'Issuing credits…'
          : `Issue ${parsed.rows.length || 0} credit${
              parsed.rows.length === 1 ? '' : 's'
            }`}
      </Button>

      {result && (
        <div className="bg-white border border-neutral-200 rounded-md p-4 text-sm">
          <p className="font-medium mb-3">
            Processed {result.perRow.length} row
            {result.perRow.length === 1 ? '' : 's'}
          </p>
          <ul className="space-y-2">
            {result.perRow.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs truncate">{r.email}</p>
                  <p className="text-xs text-neutral-500">
                    TTD ${r.amountTtd.toLocaleString('en-US')}
                    {r.note && ` · ${r.note}`}
                  </p>
                </div>
                <Outcome outcome={r.outcome} />
              </li>
            ))}
          </ul>
          {result.perRow.some((r) => r.outcome === 'unclaimed') && (
            <p className="mt-4 text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded px-3 py-2">
              Unclaimed rows are held by email. They&apos;ll auto-attach when
              the recipient signs up at pinnaclefitness.app with that email.
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
  outcome: IssueResult['perRow'][number]['outcome']
}) {
  switch (outcome) {
    case 'attached':
      return (
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-turquoise-100 text-turquoise-800">
          <CheckCircle2 size={12} />
          Credited
        </span>
      )
    case 'unclaimed':
      return (
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
          <Clock size={12} />
          Unclaimed
        </span>
      )
    case 'failed':
      return (
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <AlertCircle size={12} />
          Failed
        </span>
      )
  }
}
