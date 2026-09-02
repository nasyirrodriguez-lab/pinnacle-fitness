import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'
import { parseTstzRange } from '@/lib/booking/slots'
import { cn } from '@/lib/utils'
import { fmtAstDateTime, fmtAstTime } from '@/lib/time/ast'
import AdminCancelBookingButton from '@/components/admin/admin-cancel-booking-button'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    when?: 'today' | 'week' | 'upcoming' | 'past'
    status?: string
  }>
}

interface BookingRow {
  id: string
  ids: string[]
  slotCount: number
  groupId: string | null
  startIso: string
  endIso: string
  status: string
  priceCents: number
  resourceName: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  guestName: string | null
  guestEmail: string | null
  notes: string | null
  isPaid: boolean
  paidOnline: boolean
  checkedInAt: string | null
}

const PAGE_LIMIT = 100

async function loadBookings(args: {
  when: 'today' | 'week' | 'upcoming' | 'past'
  status?: string
}): Promise<BookingRow[]> {
  const admin = createAdminClient()

  // The SQL helper does AST day-boundary math + the filter properly
  // (PostgREST string-range comparison on a tstzrange column doesn't
  // behave as you'd expect). It also surfaces guest_name / guest_email
  // so admin-on-behalf bookings populate the Member column.
  const { data, error } = await admin.rpc('admin_bookings_list', {
    when_filter: args.when,
    status_filter: args.status ?? null,
    row_limit: PAGE_LIMIT,
  })
  if (error || !data) return []

  type RpcRow = {
    id: string
    during: string
    status: string
    price_cents: number
    user_id: string | null
    guest_name: string | null
    guest_email: string | null
    resource_id: string
    resource_name: string | null
    full_name: string | null
    email: string | null
    notes: string | null
    payment_id: string | null
    paid_at: string | null
    checked_in_at: string | null
    booking_group_id: string | null
  }

  const rows: BookingRow[] = []
  for (const raw of data as RpcRow[]) {
    const range = parseTstzRange(raw.during)
    if (!range) continue
    rows.push({
      id: raw.id,
      ids: [raw.id],
      slotCount: 1,
      groupId: raw.booking_group_id,
      startIso: range.during_lower,
      endIso: range.during_upper,
      status: raw.status,
      priceCents: raw.price_cents ?? 0,
      resourceName: raw.resource_name ?? raw.resource_id,
      userId: raw.user_id,
      // Self-signup profiles can carry an empty-string name; normalize to
      // null so the email fallback actually kicks in downstream.
      userName: raw.full_name?.trim() || null,
      userEmail: raw.email,
      guestName: raw.guest_name,
      guestEmail: raw.guest_email,
      notes: raw.notes,
      isPaid: raw.payment_id !== null || raw.paid_at !== null,
      paidOnline: raw.payment_id !== null,
      checkedInAt: raw.checked_in_at,
    })
  }
  // One checkout can span many 30-minute slots; the admin wants to see
  // one meeting, not six rows. Merge back-to-back slots that belong to
  // the same booking group into a single row spanning the full time.
  const merged: BookingRow[] = []
  for (const row of rows) {
    const prev = merged[merged.length - 1]
    const contiguous =
      prev &&
      prev.groupId !== null &&
      prev.groupId === row.groupId &&
      prev.resourceName === row.resourceName &&
      prev.status === row.status &&
      (prev.endIso === row.startIso || prev.startIso === row.endIso)
    if (contiguous) {
      prev.ids.push(row.id)
      prev.slotCount += 1
      prev.priceCents += row.priceCents
      if (new Date(row.endIso) > new Date(prev.endIso)) prev.endIso = row.endIso
      if (new Date(row.startIso) < new Date(prev.startIso))
        prev.startIso = row.startIso
      prev.isPaid = prev.isPaid && row.isPaid
      prev.checkedInAt = prev.checkedInAt ?? row.checkedInAt
    } else {
      merged.push(row)
    }
  }
  return merged
}

const fmtDateTime = fmtAstDateTime

function fmtPrice(cents: number): string {
  return `TTD $${(cents / 100).toFixed(0)}`
}

function FilterTab({
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-900',
    held: 'bg-orange-100 text-orange-900',
    completed: 'bg-neutral-100 text-neutral-700',
    cancelled: 'bg-neutral-200 text-neutral-600',
    no_show: 'bg-red-100 text-red-900',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded',
        styles[status] ?? 'bg-neutral-100 text-neutral-700'
      )}
    >
      {status}
    </span>
  )
}

export default async function AdminBookingsPage({ searchParams }: PageProps) {
  const { when = 'upcoming', status } = await searchParams
  const rows = await loadBookings({ when, status })

  const buildHref = (newWhen?: string, newStatus?: string) => {
    const params = new URLSearchParams()
    if (newWhen ?? when) params.set('when', newWhen ?? when)
    const s = newStatus !== undefined ? newStatus : status
    if (s) params.set('status', s)
    const qs = params.toString()
    return qs ? `/admin/bookings?${qs}` : '/admin/bookings'
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl mb-1">Bookings</h1>
          <p className="text-neutral-600">
            All bookings across every member. {rows.length} shown
            {rows.length === PAGE_LIMIT && ' (capped at 100)'}.
          </p>
        </div>
        <Link
          href="/admin/bookings/new"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-darkBlue-900 text-white rounded-md hover:bg-darkBlue-800 shrink-0"
        >
          Book on behalf
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="inline-flex gap-1 p-1 bg-neutral-100 rounded-md">
          <FilterTab
            href={buildHref('today')}
            label="Today"
            active={when === 'today'}
          />
          <FilterTab
            href={buildHref('week')}
            label="This week"
            active={when === 'week'}
          />
          <FilterTab
            href={buildHref('upcoming')}
            label="Upcoming"
            active={when === 'upcoming'}
          />
          <FilterTab
            href={buildHref('past')}
            label="Past"
            active={when === 'past'}
          />
        </div>
        <div className="inline-flex gap-1 p-1 bg-neutral-100 rounded-md">
          <FilterTab
            href={buildHref(undefined, undefined)}
            label="All"
            active={!status}
          />
          <FilterTab
            href={buildHref(undefined, 'confirmed')}
            label="Confirmed"
            active={status === 'confirmed'}
          />
          <FilterTab
            href={buildHref(undefined, 'held')}
            label="Held"
            active={status === 'held'}
          />
          <FilterTab
            href={buildHref(undefined, 'cancelled')}
            label="Cancelled"
            active={status === 'cancelled'}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center text-neutral-500">
          No bookings match these filters.
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-neutral-50 transition">
                  <td className="px-4 py-3 text-sm">
                    {fmtDateTime(b.startIso)}
                    <span className="text-neutral-500">
                      {' – '}
                      {fmtAstTime(b.endIso)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {b.resourceName}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {b.userId ? (
                      <Link
                        href={`/admin/members/${b.userId}`}
                        className="hover:text-darkBlue-900"
                      >
                        <span className="font-medium">
                          {b.userName ?? b.userEmail ?? '—'}
                        </span>
                        {b.userEmail && b.userName && (
                          <span className="text-xs text-neutral-500 ml-1">
                            {b.userEmail}
                          </span>
                        )}
                      </Link>
                    ) : b.guestName ? (
                      <>
                        <span className="font-medium">{b.guestName}</span>
                        {b.guestEmail &&
                          !b.guestEmail.includes('@theworx.local') && (
                            <span className="text-xs text-neutral-500 ml-1">
                              {b.guestEmail}
                            </span>
                          )}
                        <span className="ml-1 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-neutral-100 text-neutral-600">
                          GUEST
                        </span>
                      </>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={b.status} />
                      {b.checkedInAt && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-turquoise-100 text-turquoise-900">
                          HERE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {fmtPrice(b.priceCents)}
                      {b.priceCents > 0 && (
                        <span
                          className={
                            b.isPaid
                              ? 'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-lime-100 text-lime-900'
                              : 'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-orange-100 text-orange-900'
                          }
                        >
                          {b.isPaid ? 'PAID' : 'UNPAID'}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="text-xs font-medium text-darkBlue-900 hover:underline"
                      >
                        Edit
                      </Link>
                      {(b.status === 'confirmed' || b.status === 'held') && (
                        <AdminCancelBookingButton
                          bookingId={b.id}
                          bookingIds={b.ids}
                          resourceName={b.resourceName}
                          startIso={b.startIso}
                          memberName={
                            b.userName ?? b.userEmail ?? b.guestName ?? null
                          }
                          compact
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
