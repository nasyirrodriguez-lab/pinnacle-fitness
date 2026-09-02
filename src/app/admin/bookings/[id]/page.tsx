import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { parseTstzRange } from '@/lib/booking/slots'
import { fmtAstDateTime } from '@/lib/time/ast'
import AdminBookingEditor from '@/components/admin/admin-booking-editor'
import BookingOpsButtons from '@/components/admin/booking-ops-buttons'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Booking — Admin',
}

interface ResourceOption {
  id: string
  name: string
  pricePerHourCents: number
  afterHoursPricePerHourCents: number | null
  afterHoursStartsAtHour: number | null
  slotMinutes: number
  openHour: number
  closeHour: number
}

interface BookingDetail {
  id: string
  startIso: string
  endIso: string
  status: string
  priceCents: number
  resourceId: string
  resourceName: string
  notes: string | null
  userId: string | null
  userFullName: string | null
  userEmail: string | null
  userPhone: string | null
  guestName: string | null
  guestEmail: string | null
  guestPhone: string | null
  paymentId: string | null
  paidAt: string | null
  checkedInAt: string | null
  createdAt: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

async function loadData(bookingId: string): Promise<{
  booking: BookingDetail
  resources: ResourceOption[]
} | null> {
  const admin = createAdminClient()
  const [bookingRes, resourcesRes] = await Promise.all([
    admin
      .from('bookings')
      .select(
        'id, during, status, price_cents, resource_id, notes, user_id, guest_name, guest_email, booking_group_id, created_at, payment_id, paid_at, checked_in_at, resources(name), profiles(full_name, email, phone)'
      )
      .eq('id', bookingId)
      .maybeSingle(),
    admin
      .from('resources')
      .select(
        'id, name, price_per_hour_cents, after_hours_price_per_hour_cents, after_hours_starts_at_hour, slot_minutes, open_hour, close_hour, is_bookable'
      )
      .order('display_order', { ascending: true }),
  ])

  if (bookingRes.error || !bookingRes.data) return null
  const raw = bookingRes.data as Record<string, unknown>
  const range = parseTstzRange(raw.during as string)
  if (!range) return null

  // Optional: pull guest_phone from booking_groups if it's an admin-on-
  // behalf guest booking; bookings table itself doesn't carry phone.
  let guestPhone: string | null = null
  if (raw.user_id === null) {
    const { data: groupRow } = await admin
      .from('booking_groups')
      .select('guest_phone')
      .eq('id', (raw.booking_group_id as string) ?? '')
      .maybeSingle()
    guestPhone =
      (groupRow as { guest_phone?: string | null } | null)?.guest_phone ?? null
  }

  const resourceRaw = raw.resources as
    | { name?: string }
    | { name?: string }[]
    | null
  const resource = Array.isArray(resourceRaw) ? resourceRaw[0] : resourceRaw
  const profileRaw = raw.profiles as
    | { full_name?: string; email?: string; phone?: string | null }
    | { full_name?: string; email?: string; phone?: string | null }[]
    | null
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw

  const booking: BookingDetail = {
    id: raw.id as string,
    startIso: range.during_lower,
    endIso: range.during_upper,
    status: raw.status as string,
    priceCents: (raw.price_cents as number) ?? 0,
    resourceId: raw.resource_id as string,
    resourceName: resource?.name ?? (raw.resource_id as string),
    notes: (raw.notes as string | null) ?? null,
    userId: (raw.user_id as string | null) ?? null,
    userFullName: profile?.full_name?.trim() || null,
    userEmail: profile?.email ?? null,
    userPhone: profile?.phone?.trim() || null,
    guestName: (raw.guest_name as string | null) ?? null,
    guestEmail: (raw.guest_email as string | null) ?? null,
    guestPhone,
    paymentId: (raw.payment_id as string | null) ?? null,
    paidAt: (raw.paid_at as string | null) ?? null,
    checkedInAt: (raw.checked_in_at as string | null) ?? null,
    createdAt: raw.created_at as string,
  }

  const resources: ResourceOption[] = (
    (resourcesRes.data as Array<{
      id: string
      name: string
      price_per_hour_cents: number | null
      after_hours_price_per_hour_cents: number | null
      after_hours_starts_at_hour: number | null
      slot_minutes: number
      open_hour: number
      close_hour: number
    }> | null) ?? []
  ).map((r) => ({
    id: r.id,
    name: r.name,
    pricePerHourCents: r.price_per_hour_cents ?? 0,
    afterHoursPricePerHourCents: r.after_hours_price_per_hour_cents,
    afterHoursStartsAtHour: r.after_hours_starts_at_hour,
    slotMinutes: r.slot_minutes,
    openHour: r.open_hour,
    closeHour: r.close_hour,
  }))

  return { booking, resources }
}

export default async function AdminBookingDetailPage({ params }: PageProps) {
  const { id } = await params
  const data = await loadData(id)
  if (!data) notFound()
  const { booking, resources } = data

  const memberLabel = booking.userId
    ? (booking.userFullName ?? booking.userEmail ?? '—')
    : null

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ChevronLeft size={16} />
        All bookings
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl mb-1">{booking.resourceName}</h1>
          <p className="text-neutral-600">{fmtAstDateTime(booking.startIso)}</p>
          {booking.userId && (booking.userEmail || booking.userPhone) && (
            <p className="text-sm text-neutral-500 mt-1">
              {[booking.userEmail, booking.userPhone]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={
                booking.status === 'confirmed'
                  ? 'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-turquoise-100 text-turquoise-900'
                  : booking.status === 'held'
                    ? 'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-900'
                    : 'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-neutral-200 text-neutral-700'
              }
            >
              {booking.status}
            </span>
            {booking.userId ? (
              <Link
                href={`/admin/members/${booking.userId}`}
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-neutral-100 text-neutral-700 hover:text-darkBlue-900"
              >
                {memberLabel}
              </Link>
            ) : booking.guestName ? (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-neutral-100 text-neutral-700">
                {booking.guestName}{' '}
                {booking.guestEmail &&
                  !booking.guestEmail.includes('@theworx.local') && (
                    <span className="ml-1 text-neutral-500">
                      · {booking.guestEmail}
                    </span>
                  )}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <BookingOpsButtons
          bookingId={booking.id}
          paidOnline={booking.paymentId !== null}
          paidManuallyAt={booking.paidAt}
          checkedInAt={booking.checkedInAt}
          canRemind={Boolean(
            (booking.userEmail ?? booking.guestEmail)?.includes('@') &&
              !booking.guestEmail?.includes('@theworx.local') &&
              booking.priceCents > 0
          )}
        />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <AdminBookingEditor booking={booking} resources={resources} />
      </div>
    </div>
  )
}
