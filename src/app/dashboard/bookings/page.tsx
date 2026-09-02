import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Calendar, ArrowRight, Clock } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createClient } from '@/utils/supabase/server'
import { parseTstzRange } from '@/lib/booking/slots'
import { cn } from '@/lib/utils'
import { fmtAstWeekdayDate, fmtAstTime, astDateKey } from '@/lib/time/ast'
import ManageBooking from '@/components/booking/manage-booking'

const CANCEL_CUTOFF_MS = 60 * 60 * 1000

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Bookings — The Worx',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ tab?: 'upcoming' | 'past' }>
}

interface BookingRow {
  id: string
  ids: string[]
  slotEnds: string[]
  startIso: string
  endIso: string
  status: string
  priceCents: number
  resourceId: string
  resourceName: string
  resourceKind: string
  bookingGroupId: string | null
  cancellable: boolean
}

async function loadBookings(
  userId: string,
  tab: 'upcoming' | 'past'
): Promise<BookingRow[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Order by start time. RLS lets the user see only their own.
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, during, status, price_cents, resource_id, booking_group_id, resources(name, kind)'
    )
    .eq('user_id', userId)
    .in('status', ['confirmed', 'held', 'completed', 'cancelled'])
    .order('during', { ascending: tab === 'upcoming' })

  if (error || !data) return []

  const now = Date.now()
  const rows: BookingRow[] = []
  for (const raw of data as Record<string, unknown>[]) {
    const range = parseTstzRange(raw.during as string)
    if (!range) continue
    const startMs = new Date(range.during_lower).getTime()
    const isUpcoming = startMs >= now
    if (tab === 'upcoming' && !isUpcoming) continue
    if (tab === 'past' && isUpcoming) continue

    const resourceRaw = raw.resources as
      | { name?: string; kind?: string }
      | { name?: string; kind?: string }[]
      | null
    const resource = Array.isArray(resourceRaw) ? resourceRaw[0] : resourceRaw

    const status = raw.status as string
    const cancellable =
      (status === 'confirmed' || status === 'held') &&
      startMs - now >= CANCEL_CUTOFF_MS
    rows.push({
      id: raw.id as string,
      ids: [raw.id as string],
      slotEnds: [range.during_upper],
      startIso: range.during_lower,
      endIso: range.during_upper,
      status,
      priceCents: (raw.price_cents as number) ?? 0,
      resourceId: (raw.resource_id as string) ?? '',
      resourceName: resource?.name ?? 'Booking',
      resourceKind: resource?.kind ?? '',
      bookingGroupId: (raw.booking_group_id as string | null) ?? null,
      cancellable,
    })
  }

  // Merge back-to-back slots from the same checkout into one booking
  // row — members see one meeting with its full time, not six 30-minute
  // fragments.
  const sorted = [...rows].sort(
    (a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime()
  )
  const merged: BookingRow[] = []
  for (const row of sorted) {
    const prev = merged[merged.length - 1]
    if (
      prev &&
      prev.bookingGroupId !== null &&
      prev.bookingGroupId === row.bookingGroupId &&
      prev.status === row.status &&
      prev.endIso === row.startIso
    ) {
      prev.ids.push(row.id)
      prev.slotEnds.push(row.endIso)
      prev.endIso = row.endIso
      prev.priceCents += row.priceCents
      prev.cancellable = prev.cancellable && row.cancellable
    } else {
      merged.push(row)
    }
  }
  if (tab === 'past') {
    merged.sort(
      (a, b) => new Date(b.startIso).getTime() - new Date(a.startIso).getTime()
    )
  }
  return merged
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-900',
    held: 'bg-orange-100 text-orange-900',
    completed: 'bg-neutral-100 text-neutral-700',
    cancelled: 'bg-neutral-200 text-neutral-600',
  }
  const label: Record<string, string> = {
    confirmed: 'Confirmed',
    held: 'Awaiting payment',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded',
        styles[status] ?? 'bg-neutral-100 text-neutral-700'
      )}
    >
      {label[status] ?? status}
    </span>
  )
}

function fmtRange(startIso: string, endIso: string): string {
  return `${fmtAstWeekdayDate(startIso)} · ${fmtAstTime(startIso)} – ${fmtAstTime(endIso)}`
}

function fmtPrice(cents: number): string {
  return `TTD $${(cents / 100).toFixed(0)}`
}

function Tab({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'px-3 py-1 text-sm font-medium rounded transition',
        active
          ? 'bg-white text-neutral-900 shadow-sm'
          : 'text-neutral-600 hover:text-neutral-900'
      )}
    >
      {label}
    </Link>
  )
}

export default async function BookingsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const { tab = 'upcoming' } = await searchParams
  const rows = await loadBookings(user.id, tab)

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl mb-1">Bookings</h1>
          <p className="text-neutral-600">
            Your meeting room and conference room reservations.
          </p>
        </div>
        <div className="inline-flex gap-1 p-1 bg-neutral-100 rounded-md">
          <Tab
            href="/dashboard/bookings"
            label="Upcoming"
            active={tab === 'upcoming'}
          />
          <Tab
            href="/dashboard/bookings?tab=past"
            label="Past"
            active={tab === 'past'}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
          <Calendar size={32} className="mx-auto mb-3 text-neutral-400" />
          <p className="font-medium mb-1">
            {tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
          </p>
          <p className="text-sm text-neutral-500 mb-6">
            {tab === 'upcoming'
              ? 'Reserve a room — meeting room or conference room, by the hour.'
              : 'Your booking history will appear here.'}
          </p>
          {tab === 'upcoming' && (
            <Link
              href="/book"
              className="inline-flex items-center gap-1 text-sm font-medium text-turquoise-700 hover:text-turquoise-900"
            >
              Book a room
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((b) => {
            return (
              <li
                key={b.id}
                className="bg-white border border-neutral-200 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{b.resourceName}</p>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-sm text-neutral-600 flex items-center gap-1">
                    <Clock size={14} />
                    {fmtRange(b.startIso, b.endIso)}
                  </p>
                </div>
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <p className="text-sm font-medium">
                    {fmtPrice(b.priceCents)}
                  </p>
                </div>
                {b.cancellable && b.status === 'confirmed' && (
                  <ManageBooking
                    bookingIds={b.ids}
                    resourceId={b.resourceId}
                    resourceName={b.resourceName}
                    dateKey={astDateKey(new Date(b.startIso))}
                    slotEnds={b.slotEnds}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-6">
        <Link
          href="/book"
          className="inline-flex items-center gap-1 text-sm font-medium text-turquoise-700 hover:text-turquoise-900"
        >
          Book another room
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
