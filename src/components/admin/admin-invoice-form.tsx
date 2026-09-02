'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, FileText, Play } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  adminCreateInvoice,
  adminRunMonthlyInvoicing,
} from '@/app/admin/invoices/actions'

interface Line {
  label: string
  amount: string
}

const KINDS = [
  ['membership', 'Membership'],
  ['other', 'Other'],
] as const

export function AdminInvoiceForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [kind, setKind] = useState<string>('office_rental')
  const [lines, setLines] = useState<Line[]>([{ label: '', amount: '' }])
  const [periodLabel, setPeriodLabel] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [renews, setRenews] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const totalCents = lines.reduce((sum, l) => {
    const n = Number.parseFloat(l.amount)
    return sum + (Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0)
  }, 0)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSent(null)
    startTransition(async () => {
      const result = await adminCreateInvoice({
        email: email.trim(),
        kind: kind as (typeof KINDS)[number][0],
        lineItems: lines
          .filter((l) => l.label.trim() && Number.parseFloat(l.amount) > 0)
          .map((l) => ({
            label: l.label.trim(),
            amountCents: Math.round(Number.parseFloat(l.amount) * 100),
          })),
        periodLabel: periodLabel.trim() || undefined,
        dueAt: dueAt || undefined,
        renewsMembership: renews,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSent(
        `Invoice ${result.number} sent — email with pay link is on its way.`
      )
      setLines([{ label: '', amount: '' }])
      setEmail('')
      setPeriodLabel('')
      setDueAt('')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
            Member email
          </label>
          <Input
            type="email"
            placeholder="member@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
            Type
          </label>
          <Select value={kind} onValueChange={setKind} disabled={isPending}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
          Line items
        </label>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Description, e.g. Office rent — August"
                value={line.label}
                onChange={(e) =>
                  setLines(
                    lines.map((l, j) =>
                      j === i ? { ...l, label: e.target.value } : l
                    )
                  )
                }
                disabled={isPending}
                maxLength={200}
              />
              <Input
                type="number"
                min={0}
                step={1}
                placeholder="TTD $"
                value={line.amount}
                onChange={(e) =>
                  setLines(
                    lines.map((l, j) =>
                      j === i ? { ...l, amount: e.target.value } : l
                    )
                  )
                }
                disabled={isPending}
                className="w-28"
              />
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
                  className="p-1.5 text-neutral-400 hover:text-red-700"
                  aria-label="Remove line"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLines([...lines, { label: '', amount: '' }])}
          className="mt-2 inline-flex items-center gap-1 text-xs text-darkBlue-900 underline"
          disabled={isPending}
        >
          <Plus size={12} />
          Add line
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
            Period (optional)
          </label>
          <Input
            placeholder="e.g. August 2026"
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            disabled={isPending}
            maxLength={60}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
            Due date (optional)
          </label>
          <Input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={renews}
          onCheckedChange={(v) => setRenews(v === true)}
          disabled={isPending}
        />
        Paying this invoice renews their membership by a month
      </label>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {sent && <p className="text-sm text-turquoise-700">{sent}</p>}

      <Button
        type="submit"
        disabled={isPending || !email.trim() || totalCents <= 0}
      >
        <FileText size={15} className="mr-1.5" />
        {isPending
          ? 'Sending…'
          : `Send invoice — TTD $${(totalCents / 100).toFixed(0)}`}
      </Button>
    </form>
  )
}

export function RunMonthlyInvoicingButton() {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const run = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await adminRunMonthlyInvoicing()
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      const r = result.result
      setMessage(
        `Done: ${r.created} invoice(s) sent, ${r.skippedExisting} already invoiced this month${r.errors.length > 0 ? `, ${r.errors.length} error(s) — check logs` : ''}.`
      )
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={run}
      >
        <Play size={14} className="mr-1.5" />
        {isPending ? 'Invoicing…' : 'Invoice this month’s renters now'}
      </Button>
      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </div>
  )
}
