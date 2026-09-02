'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  CalendarCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtAstTime } from '@/lib/time/ast'

interface ArrivalBooking {
  id: string
  ids: string[]
  displayName: string
  resourceName: string
  startIso: string | null
  endIso: string | null
  groupSize: number
  checkedIn: number
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'confirming'; booking: ArrivalBooking }
  | { kind: 'success'; name: string; checkedIn: number; groupSize: number }
  | { kind: 'error'; message: string }

// Kiosk booking arrival: today's bookings that haven't arrived yet.
// Tap your booking, confirm, you're in — same feel as check-out.
export default function BookingArrivalsClient() {
  const [bookings, setBookings] = useState<ArrivalBooking[]>([])
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [isPending, startTransition] = useTransition()

  const load = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkin/booking-arrival', {
          cache: 'no-store',
        })
        const data = (await res.json().catch(() => ({}))) as {
          bookings?: ArrivalBooking[]
          error?: string
        }
        if (!res.ok || !data.bookings) {
          setStatus({
            kind: 'error',
            message:
              data.error === 'kiosk_not_paired'
                ? 'This tablet is no longer paired. Ask an admin to re-pair.'
                : 'Could not load today’s bookings. Try again.',
          })
          return
        }
        setBookings(data.bookings)
        setStatus({ kind: 'ready' })
      } catch {
        setStatus({ kind: 'error', message: 'Network error. Try again.' })
      }
    })
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (status.kind !== 'success') return
    const partialGroup = status.checkedIn < status.groupSize
    const t = window.setTimeout(
      () => {
        if (partialGroup) {
          setStatus({ kind: 'loading' })
          load()
        } else {
          window.location.href = '/checkin'
        }
      },
      partialGroup ? 3500 : 8000
    )
    return () => window.clearTimeout(t)
  }, [status])

  const arrive = (booking: ArrivalBooking) => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkin/booking-arrival', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingIds: booking.ids }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          checkedIn?: number
          groupSize?: number
        }
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message:
              data.error === 'already_checked_in'
                ? 'This booking is already fully checked in. All good!'
                : 'Could not check you in. Ask the team for a hand.',
          })
          return
        }
        setStatus({
          kind: 'success',
          name: booking.displayName,
          checkedIn: data.checkedIn ?? 1,
          groupSize: data.groupSize ?? 1,
        })
      } catch {
        setStatus({ kind: 'error', message: 'Network error. Try again.' })
      }
    })
  }

  if (status.kind === 'success') {
    const remaining = status.groupSize - status.checkedIn
    return (
      <Card>
        <CheckCircle2 size={56} className="text-turquoise-500 mb-3" />
        <h2 className="font-heading text-3xl mb-1">
          {status.groupSize > 1
            ? `Welcome! ${status.checkedIn} of ${status.groupSize} in`
            : `Welcome, ${status.name.split(' ')[0]}!`}
        </h2>
        <p className="text-neutral-600">
          {remaining > 0
            ? `Checked in. ${remaining} more from your group can tap the same booking.`
            : "You're all checked in. Your space is ready when you are."}
        </p>
      </Card>
    )
  }

  if (status.kind === 'error') {
    return (
      <Card>
        <AlertCircle size={48} className="text-red-500 mb-3" />
        <h2 className="font-heading text-xl mb-2">Something went wrong</h2>
        <p className="text-sm text-neutral-600 mb-4">{status.message}</p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setStatus({ kind: 'loading' })
              load()
            }}
          >
            Try again
          </Button>
          <Link href="/checkin">
            <Button variant="ghost">Back to check-in</Button>
          </Link>
        </div>
      </Card>
    )
  }

  if (status.kind === 'confirming') {
    const b = status.booking
    return (
      <Card>
        <CalendarCheck size={44} className="text-turquoise-600 mb-3" />
        <h2 className="font-heading text-2xl mb-1">
          {b.displayName.split(' ')[0]} — {b.resourceName}?
        </h2>
        <p className="text-sm text-neutral-600 mb-5">
          {b.startIso && b.endIso
            ? `${fmtAstTime(b.startIso)} – ${fmtAstTime(b.endIso)}`
            : 'Today'}
        </p>
        <div className="flex gap-3">
          <Button size="lg" onClick={() => arrive(b)} disabled={isPending}>
            {isPending ? 'Checking in…' : "Yes, that's my booking"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => setStatus({ kind: 'ready' })}
            disabled={isPending}
          >
            Back
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div>
      <Link
        href="/checkin"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      <h1 className="font-heading text-3xl md:text-4xl mb-2">
        Here for a booking?
      </h1>
      <p className="text-neutral-600 mb-6">
        Tap your booking to check in. Meeting rooms, the conference room, and
        event space all check in here.
      </p>

      {status.kind === 'loading' ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : bookings.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center text-neutral-500 text-sm">
          No bookings waiting to arrive today. If you just booked, give it a
          moment and try again — or ask the team.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {bookings.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setStatus({ kind: 'confirming', booking: b })}
                className="w-full flex items-center gap-4 text-left bg-white border border-neutral-200 rounded-lg p-5 hover:border-turquoise-500 hover:shadow-sm transition"
              >
                <span className="w-11 h-11 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
                  <CalendarCheck size={22} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-lg truncate">
                    {b.displayName}
                  </span>
                  <span className="block text-sm text-neutral-500">
                    {b.resourceName}
                    {b.startIso && ` · ${fmtAstTime(b.startIso)}`}
                    {b.endIso && ` – ${fmtAstTime(b.endIso)}`}
                    {b.groupSize > 1 &&
                      ` · group: ${b.checkedIn} of ${b.groupSize} in`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-10 flex flex-col items-center text-center">
      {children}
    </div>
  )
}
