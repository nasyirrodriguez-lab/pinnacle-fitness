'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Plus, Minus, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { reduceBookingRun } from '@/app/dashboard/bookings/actions'
import { fmtAstTime } from '@/lib/time/ast'

interface Props {
  bookingIds: string[]
  resourceId: string
  resourceName: string
  dateKey: string // yyyy-mm-dd for the extend link
  // Sorted slot end boundaries; all but the last are valid "new end"
  // choices when reducing.
  slotEnds: string[]
}

type Done = { cancelledCount: number; creditedCents: number; full: boolean }

// Extend, shorten, or cancel a booking. Shortening and cancelling give
// paid time back as ACCOUNT CREDIT — the refund path is team@theworx.io.
export default function ManageBooking({
  bookingIds,
  resourceId,
  resourceName,
  dateKey,
  slotEnds,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [newEnd, setNewEnd] = useState('')
  const [armCancel, setArmCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [isPending, startTransition] = useTransition()

  const reduceOptions = slotEnds.slice(0, -1)

  const run = (keepUntilIso?: string) => {
    setError(null)
    startTransition(async () => {
      const result = await reduceBookingRun({
        bookingIds,
        keepUntilIso,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDone({
        cancelledCount: result.cancelledCount,
        creditedCents: result.creditedCents,
        full: keepUntilIso === undefined,
      })
      router.refresh()
    })
  }

  if (done) {
    return (
      <div className="w-full mt-2 text-sm bg-turquoise-50 border border-turquoise-200 rounded-md px-3 py-2 text-turquoise-900">
        {done.full ? 'Booking cancelled.' : 'Booking shortened.'}{' '}
        {done.creditedCents > 0 ? (
          <>
            TTD ${(done.creditedCents / 100).toFixed(0)} has been added to your
            Worx account credit — it spends automatically on your next purchase.
            This is account credit, not a card refund; if you&apos;d prefer a
            refund, email{' '}
            <a href="mailto:team@theworx.io" className="underline">
              team@theworx.io
            </a>
            .
          </>
        ) : (
          'No charge applied to the released time.'
        )}
      </div>
    )
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings2 size={14} className="mr-1" />
        Manage
      </Button>
    )
  }

  return (
    <div className="w-full mt-2 border border-neutral-200 rounded-md p-4 space-y-4 bg-neutral-50">
      <div className="flex items-start gap-2">
        <Plus size={15} className="mt-0.5 text-turquoise-700 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Need more time?</p>
          <p className="text-neutral-600">
            Book the slots right after yours — plan hours, credit, and card all
            work as usual.{' '}
            <Link
              href={`/book/${resourceId}?date=${dateKey}`}
              className="text-turquoise-700 underline"
            >
              Extend this booking →
            </Link>
          </p>
        </div>
      </div>

      {reduceOptions.length > 0 && (
        <div className="flex items-start gap-2">
          <Minus size={15} className="mt-0.5 text-darkOrange-700 shrink-0" />
          <div className="text-sm flex-1">
            <p className="font-medium mb-1">Need less time?</p>
            <div className="flex items-center gap-2">
              <Select
                value={newEnd}
                onValueChange={setNewEnd}
                disabled={isPending}
              >
                <SelectTrigger className="h-9 w-44 bg-white">
                  <SelectValue placeholder="New end time…" />
                </SelectTrigger>
                <SelectContent>
                  {reduceOptions.map((iso) => (
                    <SelectItem key={iso} value={iso}>
                      End at {fmtAstTime(iso)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={isPending || !newEnd}
                onClick={() => run(newEnd)}
              >
                {isPending ? 'Updating…' : 'Shorten'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2">
        <XCircle size={15} className="mt-0.5 text-neutral-500 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Not coming?</p>
          {!armCancel ? (
            <button
              type="button"
              onClick={() => setArmCancel(true)}
              className="text-neutral-600 underline"
              disabled={isPending}
            >
              Cancel the whole booking
            </button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => run(undefined)}
            >
              {isPending
                ? 'Cancelling…'
                : `Yes, cancel my ${resourceName} booking`}
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-neutral-500 border-t border-neutral-200 pt-3">
        Time you give up is returned as <strong>Worx account credit</strong>,
        not a card refund — it applies automatically to your next purchase.
        Prefer a refund? Email{' '}
        <a href="mailto:team@theworx.io" className="underline">
          team@theworx.io
        </a>
        .
      </p>

      {error && <p className="text-xs text-red-700">{error}</p>}

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-neutral-500 underline"
        disabled={isPending}
      >
        Close
      </button>
    </div>
  )
}
