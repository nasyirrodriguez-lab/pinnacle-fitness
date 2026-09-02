'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarPlus, CheckCircle2, ChevronLeft } from 'lucide-react'
import type { CoachSlot } from '@/lib/coaches/availability'
import type { DaySummary } from '@/lib/booking/pt'
import { fmtAstTime, fmtAstWeekdayDate } from '@/lib/time/ast'

interface CoachTab {
  resourceId: string
  name: string
  slug: string
}

interface Reschedule {
  bookingId: string
  label: string
  outcome: 'free' | 'uses_session' | 'too_late'
}

interface Props {
  resourceId: string
  coachName: string
  coachBio: string | null
  capacity: number
  tabs: CoachTab[]
  days: DaySummary[]
  initialDate: string
  initialSlots: CoachSlot[]
  ptLeft: number | null // null = unlimited
  reservedCount: number
  reschedule: Reschedule | null
}

interface CreatedBooking {
  id: string
  coachName: string
  startIso: string
  endIso: string
  dayLabel: string
  timeLabel: string
}

function dayChipLabel(dateKey: string): { dow: string; day: string } {
  const d = new Date(`${dateKey}T12:00:00-04:00`)
  return {
    dow: new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Port_of_Spain',
      weekday: 'short',
    }).format(d),
    day: new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Port_of_Spain',
      day: 'numeric',
    }).format(d),
  }
}

export default function PtBookingClient({
  resourceId,
  coachName,
  coachBio,
  capacity,
  tabs,
  days,
  initialDate,
  initialSlots,
  ptLeft,
  reservedCount,
  reschedule,
}: Props) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate)
  const [slots, setSlots] = useState<CoachSlot[]>(initialSlots)
  const [daySummary, setDaySummary] = useState<DaySummary[]>(days)
  const [selected, setSelected] = useState<CoachSlot | null>(null)
  const [loadingDay, startLoadDay] = useTransition()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<CreatedBooking | null>(null)

  const unlimited = ptLeft === null
  const bookable = unlimited ? Infinity : ptLeft - reservedCount + (reschedule ? 1 : 0)
  const leftAfter = unlimited ? null : Math.max(0, ptLeft - reservedCount - (reschedule ? 0 : 1))

  const pickDay = (key: string) => {
    if (key === date) return
    setSelected(null)
    setError(null)
    startLoadDay(async () => {
      try {
        const res = await fetch(
          `/api/bookings/availability?resourceId=${encodeURIComponent(resourceId)}&date=${key}`,
          { cache: 'no-store' }
        )
        const data = (await res.json()) as {
          slots?: CoachSlot[]
          days?: DaySummary[]
        }
        setDate(key)
        setSlots(data.slots ?? [])
        if (data.days) setDaySummary(data.days)
      } catch {
        setError('Could not load that day. Try again.')
      }
    })
  }

  // Keep the URL in sync so a refresh lands on the same day.
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('date', date)
    window.history.replaceState(null, '', url.toString())
  }, [date])

  const confirm = () => {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      try {
        const res = reschedule
          ? await fetch('/api/bookings/cancel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bookingId: reschedule.bookingId,
                reschedule: { resourceId, startIso: selected.startIso },
              }),
            })
          : await fetch('/api/bookings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ resourceId, startIso: selected.startIso }),
            })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          message?: string
          error?: string
          booking?: CreatedBooking
          newBooking?: CreatedBooking
        }
        if (!res.ok) {
          setError(data.message ?? 'Could not book that hour.')
          if (data.error === 'slot_full' || data.error === 'slot_unavailable') {
            pickDay(date)
          }
          return
        }
        const created = data.booking ?? data.newBooking ?? null
        if (created) setDone(created)
        router.refresh()
      } catch {
        setError('Network error. Try again.')
      }
    })
  }

  if (done) {
    return (
      <div className="bg-card border border-border rounded-[22px] p-8 text-center">
        <CheckCircle2 size={56} className="mx-auto text-primary mb-3" />
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2">
          {reschedule ? 'Rescheduled' : 'Booked'}
        </p>
        <h2 className="font-heading text-3xl mb-2">
          {done.dayLabel} · {done.timeLabel}
        </h2>
        <p className="text-muted-foreground mb-1">
          PT with {done.coachName} · 60 minutes
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Scan your QR at the iPad when you arrive — that&apos;s when the
          session is used.
          {leftAfter !== null && (
            <>
              {' '}
              <span className="font-stat text-xl text-primary">{leftAfter}</span>{' '}
              left after this one.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a
            href={`/api/bookings/${done.id}/ics`}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
          >
            <CalendarPlus size={16} />
            Add to calendar
          </a>
          <button
            type="button"
            onClick={() => {
              setDone(null)
              setSelected(null)
              pickDay(date)
            }}
            className="px-5 py-3 rounded-full border border-foreground text-sm font-semibold"
          >
            Book another
          </button>
          <Link
            href="/dashboard/bookings"
            className="px-5 py-3 rounded-full text-sm font-semibold text-muted-foreground"
          >
            My bookings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-32">
      {reschedule && (
        <div className="mb-4 bg-card border border-border rounded-[22px] px-5 py-4 text-sm">
          <p className="font-semibold">Rescheduling {reschedule.label}</p>
          <p className="text-muted-foreground">
            {reschedule.outcome === 'free'
              ? 'Pick a new hour — your current one is released the moment the new one is confirmed.'
              : 'Inside the cancel window: moving it now uses the session. Pick a new hour anyway, or keep it.'}
          </p>
        </div>
      )}

      {/* Coach switch */}
      <div className="flex gap-2 mb-5">
        {tabs.map((t) => {
          const active = t.resourceId === resourceId
          return (
            <Link
              key={t.resourceId}
              href={`/book/${t.resourceId}?date=${date}${reschedule ? `&reschedule=${reschedule.bookingId}` : ''}`}
              className={
                active
                  ? 'flex-1 text-center px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold'
                  : 'flex-1 text-center px-4 py-2.5 rounded-full border border-border text-muted-foreground text-sm font-semibold hover:text-foreground'
              }
            >
              {t.name}
            </Link>
          )
        })}
      </div>

      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-1">
          Small-group PT · up to {capacity}
        </p>
        <h1 className="font-heading text-3xl md:text-4xl">{coachName}</h1>
        {coachBio && (
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">{coachBio}</p>
        )}
      </div>

      {/* Day strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-5">
        {daySummary.map((d) => {
          const { dow, day } = dayChipLabel(d.dateKey)
          const active = d.dateKey === date
          const dim = !d.open || d.available === 0
          return (
            <button
              key={d.dateKey}
              type="button"
              onClick={() => pickDay(d.dateKey)}
              disabled={!d.open}
              className={[
                'shrink-0 w-14 h-16 rounded-full flex flex-col items-center justify-center text-xs font-semibold transition',
                active
                  ? 'bg-primary text-primary-foreground'
                  : d.mine
                    ? 'ring-2 ring-foreground text-foreground'
                    : 'bg-card border border-border text-foreground',
                dim && !active ? 'opacity-40' : '',
              ].join(' ')}
              aria-pressed={active}
            >
              <span className="uppercase tracking-wide text-[10px]">{dow}</span>
              <span className="font-stat text-lg leading-none">{day}</span>
            </button>
          )
        })}
      </div>

      {/* Hours */}
      <p className="text-sm text-muted-foreground mb-3">
        {fmtAstWeekdayDate(`${date}T12:00:00-04:00`)}
        {loadingDay && ' · loading…'}
      </p>
      {slots.length === 0 ? (
        <div className="bg-card border border-border rounded-[22px] p-8 text-center text-muted-foreground">
          {coachName} isn&apos;t coaching this day. Pick another.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => {
            const active = selected?.startIso === s.startIso
            const disabled = !s.available || s.bookedByMe
            return (
              <button
                key={s.startIso}
                type="button"
                disabled={disabled}
                onClick={() => setSelected(active ? null : s)}
                className={[
                  'px-4 py-2.5 rounded-full text-sm font-semibold border transition',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : s.bookedByMe
                      ? 'bg-foreground text-background border-foreground'
                      : disabled
                        ? 'border-border text-muted-foreground opacity-40'
                        : 'border-foreground text-foreground hover:bg-card',
                ].join(' ')}
                aria-pressed={active}
              >
                {fmtAstTime(s.startIso)}
                <span className="ml-2 font-normal opacity-70">
                  {s.bookedByMe
                    ? 'you’re in'
                    : s.isFull
                      ? 'full'
                      : `${s.booked} of ${s.capacity}`}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {error && <p className="text-sm text-destructive mt-4">{error}</p>}

      {/* Sticky confirm bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 p-4 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto bg-card border border-border rounded-[22px] p-4 shadow-2xl flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            {selected ? (
              <>
                <p className="font-semibold truncate">
                  {reschedule ? 'Move to' : 'Book'} {fmtAstTime(selected.startIso)} with{' '}
                  {coachName}
                </p>
                <p className="text-xs text-muted-foreground">
                  uses 1 PT session at check-in
                  {leftAfter !== null && ` · ${leftAfter} left after`}
                </p>
              </>
            ) : bookable <= 0 ? (
              <>
                <p className="font-semibold">All your sessions are reserved</p>
                <p className="text-xs text-muted-foreground">
                  <Link href="/buy" className="underline">
                    Top up a pack
                  </Link>{' '}
                  or wait for your plan to renew.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">Pick an hour</p>
                <p className="text-xs text-muted-foreground">
                  {unlimited
                    ? 'Unlimited plan · book as many as you like'
                    : `${Math.max(0, ptLeft - reservedCount)} session${ptLeft - reservedCount === 1 ? '' : 's'} free to book`}
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            disabled={!selected || isPending || bookable <= 0}
            onClick={confirm}
            className="px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
          >
            {isPending ? 'Booking…' : reschedule ? 'Confirm move' : 'Confirm'}
          </button>
        </div>
      </div>

      <div className="mt-8">
        <Link
          href="/book"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={16} />
          Coaches
        </Link>
      </div>
    </div>
  )
}
