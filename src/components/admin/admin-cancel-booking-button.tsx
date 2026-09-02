'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { adminCancelBooking } from '@/app/admin/bookings/actions'

interface Props {
  bookingId: string
  // All slot ids when this row represents a merged multi-slot booking.
  bookingIds?: string[]
  resourceName: string
  startIso: string
  memberName?: string | null
  compact?: boolean
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Port_of_Spain',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function AdminCancelBookingButton({
  bookingId,
  bookingIds,
  resourceName,
  startIso,
  memberName,
  compact,
}: Props) {
  const allIds = bookingIds && bookingIds.length > 0 ? bookingIds : [bookingId]
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onConfirm = () => {
    setError(null)
    startTransition(async () => {
      for (const id of allIds) {
        const result = await adminCancelBooking({ bookingId: id })
        if (!result.ok && result.error !== 'Already cancelled') {
          setError(result.error)
          return
        }
      }
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size={compact ? 'sm' : 'default'}>
          Cancel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel booking?</DialogTitle>
          <DialogDescription>
            {memberName ? `${memberName}'s ` : ''}
            {resourceName} on {fmtWhen(startIso)} will be released
            {allIds.length > 1
              ? ` (all ${allIds.length} slots of this booking)`
              : ''}
            .
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900">
          This is an admin override — the standard 60-minute cutoff is skipped.
          A note will be logged on the member&apos;s record. Refunds are still
          processed manually via the Wam dashboard.
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Keep booking
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            variant="destructive"
          >
            {isPending ? 'Cancelling…' : 'Cancel booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
