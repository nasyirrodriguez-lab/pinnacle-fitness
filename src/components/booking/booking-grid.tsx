'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { fmtAstTime, astTodayKey } from '@/lib/time/ast'
import {
  buildDayGrid,
  priceSlotsCents,
  type ResourceForBooking,
  type SlotCell,
} from '@/lib/booking/slots'

interface BusyRange {
  during_lower: string
  during_upper: string
  user_id: string | null
}

interface Props {
  resource: ResourceForBooking
  date: string // YYYY-MM-DD
  busy: BusyRange[]
  currentUserId: string | null
  isSignedIn: boolean
}

interface SlotRange {
  startIso: string
  endIso: string
}

const fmtTime = fmtAstTime

function fmtRange(r: SlotRange): string {
  return `${fmtTime(r.startIso)} – ${fmtTime(r.endIso)}`
}

function durationLabel(r: SlotRange): string {
  const ms = new Date(r.endIso).getTime() - new Date(r.startIso).getTime()
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes} min`
  if (minutes % 60 === 0) return `${minutes / 60} hr`
  return `${(minutes / 60).toFixed(1)} hr`
}

function dateFromIso(iso: string): Date {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return new Date()
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function shiftDate(iso: string, days: number): string {
  const d = dateFromIso(iso)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isToday(iso: string): boolean {
  // Compare against today in AST so the date picker matches Trinidad's
  // notion of "today" regardless of the viewer's local timezone.
  return iso === astTodayKey()
}

export default function BookingGrid({
  resource,
  date,
  busy,
  currentUserId,
  isSignedIn,
}: Props) {
  const router = useRouter()
  const [selection, setSelection] = useState<SlotRange[]>([])
  const [pendingStart, setPendingStart] = useState<SlotCell | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const cells = useMemo(
    () =>
      buildDayGrid({
        resource,
        date: dateFromIso(date),
        busy,
        currentUserId,
      }),
    [resource, date, busy, currentUserId]
  )

  const totalCents = useMemo(
    () => priceSlotsCents(resource, selection),
    [resource, selection]
  )

  // True iff a slot cell falls inside any existing selection range
  const isInSelection = (cell: SlotCell): boolean => {
    const cellStart = new Date(cell.startIso).getTime()
    const cellEnd = new Date(cell.endIso).getTime()
    return selection.some((r) => {
      const rs = new Date(r.startIso).getTime()
      const re = new Date(r.endIso).getTime()
      return rs < cellEnd && re > cellStart
    })
  }

  const isPendingStart = (cell: SlotCell): boolean =>
    pendingStart !== null && pendingStart.startIso === cell.startIso

  // Find the contiguous range of available cells between two cells, inclusive.
  // Returns null if any cell in between is unavailable.
  const buildRangeBetween = (a: SlotCell, b: SlotCell): SlotRange | null => {
    const aIdx = cells.findIndex((c) => c.startIso === a.startIso)
    const bIdx = cells.findIndex((c) => c.startIso === b.startIso)
    if (aIdx === -1 || bIdx === -1) return null
    const [lo, hi] = aIdx <= bIdx ? [aIdx, bIdx] : [bIdx, aIdx]
    for (let i = lo; i <= hi; i++) {
      if (!cells[i].available) return null
    }
    return {
      startIso: cells[lo].startIso,
      endIso: cells[hi].endIso,
    }
  }

  const overlapsExistingSelection = (range: SlotRange): boolean => {
    const rs = new Date(range.startIso).getTime()
    const re = new Date(range.endIso).getTime()
    return selection.some((s) => {
      const ss = new Date(s.startIso).getTime()
      const se = new Date(s.endIso).getTime()
      return ss < re && se > rs
    })
  }

  const onCellClick = (cell: SlotCell) => {
    setError(null)
    if (!cell.available) return

    if (!pendingStart) {
      // First click — start a pending range
      if (isInSelection(cell)) {
        // Click on an already-selected slot removes that range
        setSelection((cur) =>
          cur.filter((r) => {
            const rs = new Date(r.startIso).getTime()
            const re = new Date(r.endIso).getTime()
            const cs = new Date(cell.startIso).getTime()
            return !(rs <= cs && re > cs)
          })
        )
        return
      }
      setPendingStart(cell)
      return
    }

    // Second click — try to complete the range
    const range = buildRangeBetween(pendingStart, cell)
    if (!range) {
      setError(
        'That range crosses a booked slot. Pick an end time within an open block.'
      )
      return
    }
    if (overlapsExistingSelection(range)) {
      setError(
        'That range overlaps a slot you already added. Remove the existing one first.'
      )
      return
    }
    setSelection((cur) => [...cur, range])
    setPendingStart(null)
  }

  const removeRange = (idx: number) => {
    setSelection((cur) => cur.filter((_, i) => i !== idx))
  }

  const clearSelection = () => {
    setSelection([])
    setPendingStart(null)
    setError(null)
  }

  const submit = async () => {
    if (selection.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: resource.id,
          slots: selection,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        checkoutUrl?: string
        error?: string
      }
      if (!res.ok || !body.checkoutUrl) {
        throw new Error(body.error ?? 'Could not start booking')
      }
      window.location.href = body.checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* LEFT: date nav + grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Link
            href={`/book/${resource.id}?date=${shiftDate(date, -1)}`}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border border-neutral-200 hover:bg-neutral-50"
          >
            <ChevronLeft size={16} />
            Prev
          </Link>
          <div className="text-center">
            <p className="font-heading text-lg">
              {dateFromIso(date).toLocaleDateString('en-US', {
                timeZone: 'America/Port_of_Spain',
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            {!isToday(date) && (
              <button
                type="button"
                onClick={() => router.push(`/book/${resource.id}`)}
                className="text-xs text-turquoise-700 underline"
              >
                Jump to today
              </button>
            )}
          </div>
          <Link
            href={`/book/${resource.id}?date=${shiftDate(date, 1)}`}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border border-neutral-200 hover:bg-neutral-50"
          >
            Next
            <ChevronRight size={16} />
          </Link>
        </div>

        {pendingStart && (
          <div className="mb-3 px-3 py-2 bg-turquoise-50 border border-turquoise-200 rounded-md text-sm">
            Pick an end time. You started at{' '}
            <span className="font-medium">
              {fmtTime(pendingStart.startIso)}
            </span>
            .{' '}
            <button
              type="button"
              onClick={() => setPendingStart(null)}
              className="underline text-turquoise-800"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {cells.map((cell) => {
            const inSelection = isInSelection(cell)
            const isStart = isPendingStart(cell)
            return (
              <button
                key={cell.startIso}
                type="button"
                disabled={!cell.available}
                onClick={() => onCellClick(cell)}
                className={cn(
                  'px-2 py-2 rounded text-sm border transition',
                  !cell.available &&
                    'bg-neutral-100 text-neutral-400 border-neutral-100 cursor-not-allowed line-through',
                  cell.available &&
                    !inSelection &&
                    !isStart &&
                    'bg-white border-neutral-200 hover:border-turquoise-400 hover:bg-turquoise-50',
                  isStart && 'bg-turquoise-500 text-white border-turquoise-500',
                  inSelection &&
                    'bg-turquoise-100 text-turquoise-900 border-turquoise-400'
                )}
              >
                {fmtTime(cell.startIso)}
              </button>
            )
          })}
        </div>
      </div>

      {/* RIGHT: cart */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="bg-white border border-neutral-200 rounded-lg p-5">
          <h2 className="font-heading text-lg mb-3">Your booking</h2>

          {selection.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Click a time slot to start. Click another to set the end.
            </p>
          ) : (
            <ul className="space-y-2 mb-4">
              {selection.map((r, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-2 text-sm border-b border-neutral-100 last:border-0 pb-2 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{fmtRange(r)}</p>
                    <p className="text-xs text-neutral-500">
                      {durationLabel(r)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRange(i)}
                    className="text-neutral-400 hover:text-red-600"
                    aria-label="Remove slot"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selection.length > 0 && (
            <button
              type="button"
              onClick={() => setPendingStart(null)}
              className="inline-flex items-center gap-1 text-sm text-turquoise-700 hover:text-turquoise-900 mb-4"
            >
              <Plus size={14} />
              Add another time
            </button>
          )}

          <div className="flex items-center justify-between border-t border-neutral-200 pt-4 mb-4">
            <span className="text-sm text-neutral-600">Total</span>
            <span className="font-heading text-2xl">
              {resource.currency} ${(totalCents / 100).toFixed(0)}
            </span>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isSignedIn ? (
            <Button
              onClick={submit}
              disabled={selection.length === 0 || submitting}
              className="w-full"
            >
              {submitting
                ? 'Taking you to Wam…'
                : selection.length === 0
                  ? 'Pick a time'
                  : `Book & pay ${resource.currency} $${(totalCents / 100).toFixed(0)}`}
            </Button>
          ) : (
            <Link
              href={`/sign-in?next=${encodeURIComponent(`/book/${resource.id}?date=${date}`)}`}
              className="block"
            >
              <Button className="w-full" disabled={selection.length === 0}>
                Sign in to book
              </Button>
            </Link>
          )}

          {selection.length > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-neutral-500 underline mt-3 block mx-auto"
            >
              Clear selection
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}
