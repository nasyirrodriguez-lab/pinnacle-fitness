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
import { cancelBooking } from '@/app/dashboard/bookings/actions'

interface Props {
  bookingId: string
  resourceName: string
  startIso: string
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

export default function CancelBookingButton({
  bookingId,
  resourceName,
  startIso,
}: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onConfirm = () => {
    setError(null)
    startTransition(async () => {
      const result = await cancelBooking({ bookingId })
      if (!result.ok) {
        setError(result.error)
        return
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
        <Button variant="outline" size="sm">
          Cancel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel booking?</DialogTitle>
          <DialogDescription>
            Your {resourceName} on {fmtWhen(startIso)} will be released. You
            won&apos;t be charged for this booking going forward.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900">
          Refunds for any payments already made are processed manually by the
          team — email{' '}
          <a href="mailto:team@theworx.io" className="underline font-medium">
            team@theworx.io
          </a>{' '}
          if you need one.
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
