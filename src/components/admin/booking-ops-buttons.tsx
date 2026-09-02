'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeDollarSign, DoorOpen, BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  adminSetBookingPaid,
  adminCheckInBooking,
  adminSendBookingReminder,
} from '@/app/admin/bookings/actions'
import { fmtAstTime } from '@/lib/time/ast'

interface Props {
  bookingId: string
  paidOnline: boolean
  paidManuallyAt: string | null
  checkedInAt: string | null
  canRemind?: boolean
}

// Paid toggle + arrival check-in for one booking. Online payments are
// authoritative and can't be un-marked; the manual flag is the admin's.
export default function BookingOpsButtons({
  bookingId,
  paidOnline,
  paidManuallyAt,
  checkedInAt,
  canRemind = false,
}: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [reminded, setReminded] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isPaid = paidOnline || paidManuallyAt !== null

  const remind = () => {
    setError(null)
    startTransition(async () => {
      const result = await adminSendBookingReminder({ bookingId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setReminded(true)
    })
  }

  const togglePaid = () => {
    setError(null)
    startTransition(async () => {
      const result = await adminSetBookingPaid({
        bookingId,
        paid: !isPaid,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  const checkIn = () => {
    setError(null)
    startTransition(async () => {
      const result = await adminCheckInBooking({ bookingId })
      if (!result.ok && result.error !== 'Already checked in') {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={
          isPaid
            ? 'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-lime-100 text-lime-900'
            : 'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-900'
        }
      >
        <BadgeDollarSign size={12} />
        {paidOnline ? 'Paid online' : isPaid ? 'Paid' : 'Unpaid'}
      </span>
      {!paidOnline && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={togglePaid}
        >
          {isPending ? 'Saving…' : isPaid ? 'Mark unpaid' : 'Mark paid'}
        </Button>
      )}
      {checkedInAt ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-turquoise-100 text-turquoise-900">
          <DoorOpen size={12} />
          Arrived {fmtAstTime(checkedInAt)}
        </span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={checkIn}
        >
          <DoorOpen size={14} className="mr-1" />
          {isPending ? 'Working…' : 'Check in'}
        </Button>
      )}
      {!isPaid && canRemind && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending || reminded}
          onClick={remind}
        >
          <BellRing size={14} className="mr-1" />
          {reminded ? 'Reminder sent' : 'Send payment reminder'}
        </Button>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  )
}
