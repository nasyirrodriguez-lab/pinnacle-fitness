'use client'

import { useState, useTransition } from 'react'
import { Minus, Plus, ScanLine, Settings2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fmtAstDate } from '@/lib/time/ast'
import {
  adminAdjustPassUses,
  adminCheckInWithPass,
} from '@/app/admin/members/[id]/actions'

export interface PassAdjustmentEntry {
  id: string
  deltaUses: number
  reason: string
  adminName: string | null
  createdAt: string
}

export interface PassEditorProps {
  passPurchaseId: string
  passName: string
  usesTotal: number
  usesRemaining: number
  expiresAt: string
  purchasedAt: string
  adjustments: PassAdjustmentEntry[]
}

const QUICK_DELTAS = [-2, -1, 1, 2]

const fmtDate = fmtAstDate

export default function PassRowEditor(props: PassEditorProps) {
  const [open, setOpen] = useState(false)
  const [delta, setDelta] = useState<number | null>(null)
  const [customDelta, setCustomDelta] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isCheckingIn, startCheckIn] = useTransition()

  const [renderedAtMs] = useState(() => Date.now())
  const expired = new Date(props.expiresAt).getTime() < renderedAtMs
  const empty = props.usesRemaining <= 0

  const submit = () => {
    setError(null)
    const chosen =
      delta !== null
        ? delta
        : customDelta.trim()
          ? Number.parseInt(customDelta.trim(), 10)
          : 0
    if (!Number.isFinite(chosen) || chosen === 0) {
      setError('Pick or enter a non-zero amount.')
      return
    }
    if (!reason.trim()) {
      setError('Add a reason for the audit log.')
      return
    }
    if (props.usesRemaining + chosen < 0) {
      setError(`Can't drop below zero (currently ${props.usesRemaining}).`)
      return
    }
    startTransition(async () => {
      const r = await adminAdjustPassUses({
        passPurchaseId: props.passPurchaseId,
        deltaUses: chosen,
        reason: reason.trim(),
      })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setFlash(
        `${chosen > 0 ? '+' : ''}${chosen} use${Math.abs(chosen) === 1 ? '' : 's'} · ${reason.trim()}`
      )
      setReason('')
      setDelta(null)
      setCustomDelta('')
      setOpen(false)
      // No client refresh: the server action revalidates the page.
    })
  }

  const checkIn = () => {
    setError(null)
    setFlash(null)
    startCheckIn(async () => {
      const r = await adminCheckInWithPass({
        passPurchaseId: props.passPurchaseId,
      })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setFlash('Checked in')
    })
  }

  return (
    <li className="py-3 border-b border-neutral-100 last:border-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{props.passName}</p>
          <p className="text-xs text-neutral-500">
            Purchased {fmtDate(props.purchasedAt)} · Expires{' '}
            <span className={expired ? 'text-red-700' : ''}>
              {fmtDate(props.expiresAt)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={
              empty || expired
                ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500'
                : 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-turquoise-100 text-turquoise-900'
            }
          >
            {props.usesRemaining} / {props.usesTotal} left
          </span>
          <button
            type="button"
            onClick={checkIn}
            disabled={isCheckingIn || empty || expired}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-neutral-300 rounded-md hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              empty
                ? 'No uses left'
                : expired
                  ? 'Pass has expired'
                  : 'Deduct one use and log a visit'
            }
          >
            <ScanLine size={12} />
            {isCheckingIn ? 'Checking in…' : 'Check in'}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-neutral-300 rounded-md hover:bg-neutral-50"
          >
            <Settings2 size={12} />
            Adjust
          </button>
        </div>
      </div>

      {flash && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-turquoise-700">
          <CheckCircle2 size={12} />
          {flash}
        </p>
      )}

      {open && (
        <div className="mt-3 bg-neutral-50 border border-neutral-200 rounded-md p-3 space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-neutral-500">
              Change by
            </Label>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {QUICK_DELTAS.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => {
                    setDelta(d)
                    setCustomDelta('')
                  }}
                  className={
                    delta === d
                      ? 'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border-2 border-turquoise-500 rounded-md bg-turquoise-50'
                      : 'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-neutral-300 rounded-md hover:bg-white'
                  }
                >
                  {d > 0 ? <Plus size={12} /> : <Minus size={12} />}
                  {Math.abs(d)}
                </button>
              ))}
              <Input
                type="number"
                inputMode="numeric"
                placeholder="other"
                value={customDelta}
                onChange={(e) => {
                  setCustomDelta(e.target.value)
                  setDelta(null)
                }}
                className="w-20 h-8 text-xs"
                disabled={isPending}
              />
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Adding uses also raises the total. Removing only drops what&apos;s
              left.
            </p>
          </div>

          <div>
            <Label
              htmlFor={`reason-${props.passPurchaseId}`}
              className="text-xs uppercase tracking-wide text-neutral-500"
            >
              Reason
            </Label>
            <Input
              id={`reason-${props.passPurchaseId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. comp, kiosk miscount, refund"
              maxLength={200}
              disabled={isPending}
              className="h-8 text-sm"
            />
          </div>

          {error && <p className="text-xs text-red-700">{error}</p>}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="h-8 text-xs"
            >
              {isPending ? 'Applying…' : 'Apply'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setError(null)
              }}
              className="text-xs text-neutral-500 hover:text-neutral-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {props.adjustments.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-900">
            History ({props.adjustments.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {props.adjustments.map((a) => (
              <li key={a.id} className="text-xs text-neutral-600">
                <span
                  className={
                    a.deltaUses > 0
                      ? 'font-medium text-turquoise-700'
                      : 'font-medium text-neutral-700'
                  }
                >
                  {a.deltaUses > 0 ? '+' : ''}
                  {a.deltaUses}
                </span>{' '}
                by {a.adminName ?? 'system'} · {fmtDate(a.createdAt)} ·{' '}
                {a.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}
