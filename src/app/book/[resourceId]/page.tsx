import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { needsOnboarding } from '@/lib/auth/onboarding'
import { parseTstzRange } from '@/lib/booking/slots'
import { astTodayKey, astStartOfDay, astEndOfDay } from '@/lib/time/ast'
import BookingGrid from '@/components/booking/booking-grid'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ resourceId: string }>
  searchParams: Promise<{ date?: string }>
}

// Returns a Date positioned at AST midnight on the requested date — or
// AST "today" if none provided. Server runs in UTC, so we can't rely on
// setHours(0,0,0,0).
function parseDateOrToday(raw: string | undefined): Date {
  const todayKey = astTodayKey()
  const key = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayKey
  return new Date(`${key}T00:00:00-04:00`)
}

function toIsoDate(d: Date): string {
  // Project back to an AST yyyy-mm-dd so the URL param round-trips.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Port_of_Spain',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export default async function BookResourcePage({
  params,
  searchParams,
}: PageProps) {
  const { resourceId } = await params
  const { date: rawDate } = await searchParams
  const date = parseDateOrToday(rawDate)
  const dateIso = toIsoDate(date)

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const user = await getCurrentUser()

  // Someone who signed up just to book skips /welcome unless we route
  // them through it — and then their booking arrives with no name or
  // phone attached. Collect the details first, then bring them back.
  if (user && needsOnboarding(user)) {
    redirect(
      `/welcome?next=${encodeURIComponent(`/book/${resourceId}?date=${dateIso}`)}`
    )
  }

  const { data: resourceRow, error: resourceErr } = await supabase
    .from('resources')
    .select(
      'id, name, description, kind, capacity, price_per_hour_cents, after_hours_price_per_hour_cents, after_hours_starts_at_hour, currency, open_hour, close_hour, slot_minutes, is_bookable, admin_only'
    )
    .eq('id', resourceId)
    .eq('is_bookable', true)
    .neq('admin_only', true)
    .maybeSingle()

  if (resourceErr || !resourceRow) notFound()
  const r = resourceRow as Record<string, unknown>
  const resource = {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    kind: r.kind as string,
    capacity: r.capacity as number,
    price_per_hour_cents: (r.price_per_hour_cents as number | null) ?? null,
    after_hours_price_per_hour_cents:
      (r.after_hours_price_per_hour_cents as number | null) ?? null,
    after_hours_starts_at_hour:
      (r.after_hours_starts_at_hour as number | null) ?? null,
    currency: r.currency as string,
    open_hour: r.open_hour as number,
    close_hour: r.close_hour as number,
    slot_minutes: r.slot_minutes as number,
  }

  // Day window for the busy query — boundaries in AST so a member
  // booking AST-Wednesday-9pm gets matched as a Wednesday slot, not
  // a Thursday one because UTC has rolled over.
  const dayStart = astStartOfDay(date)
  const dayEnd = astEndOfDay(date)

  // Use the admin client would be needed for cross-user reads, but RLS on
  // bookings only allows users to see their own. For availability we need
  // every booking on this resource — so use a public view OR the admin client.
  // For now we expose busy info via the admin client (no PII — just ranges).
  const { createAdminClient } = await import('@/utils/supabase/admin')
  const admin = createAdminClient()
  const { data: busyRows } = await admin
    .from('bookings')
    .select('during, user_id, status')
    .eq('resource_id', resource.id)
    .in('status', ['held', 'confirmed'])
    .gte('during', `[${dayStart.toISOString()},)`)
    .lt('during', `[${dayEnd.toISOString()},)`)

  type BusyRow = { during: string; user_id: string | null; status: string }
  const busy = ((busyRows as BusyRow[] | null) ?? [])
    .map((row) => {
      const parsed = parseTstzRange(row.during)
      if (!parsed) return null
      return {
        during_lower: parsed.during_lower,
        during_upper: parsed.during_upper,
        user_id: row.user_id,
      }
    })
    .filter(
      (
        r
      ): r is {
        during_lower: string
        during_upper: string
        user_id: string | null
      } => r !== null
    )

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
      <Link
        href="/book"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ChevronLeft size={16} />
        All rooms
      </Link>

      <div className="mb-6">
        <h1 className="font-heading text-3xl md:text-4xl mb-1">
          {resource.name}
        </h1>
        {resource.description && (
          <p className="text-neutral-600">{resource.description}</p>
        )}
        <p className="text-sm text-neutral-500 mt-2">
          {resource.currency} $ {(resource.price_per_hour_cents ?? 0) / 100}/hr
          · Up to {resource.capacity} people · {resource.slot_minutes}-min slots
        </p>
      </div>

      <BookingGrid
        resource={resource}
        date={dateIso}
        busy={busy}
        currentUserId={user?.id ?? null}
        isSignedIn={Boolean(user)}
      />
    </div>
  )
}
