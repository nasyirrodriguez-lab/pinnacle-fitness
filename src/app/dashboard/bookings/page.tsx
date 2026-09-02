import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Calendar } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createAdminClient } from '@/utils/supabase/admin'
import { memberAccess } from '@/lib/gym/entitlement'
import { loadGymSettings } from '@/lib/gym/settings'
import { cancelOutcome } from '@/lib/gym/rules'
import { parseTstzRange } from '@/lib/booking/slots'
import { PT_RESOURCE_IDS, reservedPtCount } from '@/lib/booking/pt'
import { fmtAstDate, fmtAstTime, fmtAstWeekdayDate } from '@/lib/time/ast'
import BookingActions from '@/components/booking/booking-actions'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Bookings — Pinnacle Fitness',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ tab?: 'upcoming' | 'past' }>
}

interface BookingRow {
  id: string
  resourceId: string
  coachName: string
  startIso: string
  endIso: string
  status: string
  checkedIn: boolean
  countdown: string
}

// Splits into upcoming / past here (not in render) so the clock read
// happens once, in data loading.
async function loadBookings(
  userId: string
): Promise<{ upcoming: BookingRow[]; past: BookingRow[] }> {
  const now = Date.now()
  const admin = createAdminClient()
  const { data } = await admin
    .from('bookings')
    .select('id, resource_id, during, status, checked_in_at, resources(name)')
    .eq('user_id', userId)
    .in('resource_id', [...PT_RESOURCE_IDS])
    .in('status', ['confirmed', 'completed', 'cancelled', 'no_show'])
    .order('during', { ascending: false })
    .limit(200)
  const rows = ((data as Record<string, unknown>[] | null) ?? [])
    .map((raw) => {
      const range = parseTstzRange(raw.during as string)
      if (!range) return null
      const resRaw = raw.resources as { name?: string } | { name?: string }[] | null
      const res = Array.isArray(resRaw) ? (resRaw[0] ?? null) : resRaw
      return {
        id: raw.id as string,
        resourceId: raw.resource_id as string,
        coachName: res?.name ?? 'PT',
        startIso: range.during_lower,
        endIso: range.during_upper,
        status: raw.status as string,
        checkedIn: Boolean(raw.checked_in_at),
        countdown: countdown(range.during_lower, now),
      }
    })
    .filter((b): b is BookingRow => b !== null)
  const upcoming = rows
    .filter(
      (b) =>
        b.status === 'confirmed' &&
        new Date(b.endIso).getTime() > now &&
        !b.checkedIn
    )
    .sort((a, b) => a.startIso.localeCompare(b.startIso))
  const past = rows.filter((b) => !upcoming.includes(b))
  return { upcoming, past }
}

function countdown(startIso: string, now: number): string {
  const ms = new Date(startIso).getTime() - now
  if (ms <= 0) return 'now'
  const h = Math.floor(ms / (60 * 60 * 1000))
  if (h < 1) return `in ${Math.max(1, Math.round(ms / 60000))} min`
  if (h < 24) return `in ${h}h`
  const d = Math.round(h / 24)
  return `in ${d} day${d === 1 ? '' : 's'}`
}

function Badge({ status, checkedIn }: { status: string; checkedIn: boolean }) {
  const label =
    status === 'cancelled'
      ? 'Cancelled'
      : status === 'no_show'
        ? 'No-show'
        : checkedIn || status === 'completed'
          ? 'Checked in'
          : 'Missed'
  const cls =
    label === 'Checked in'
      ? 'bg-primary text-primary-foreground'
      : label === 'No-show'
        ? 'bg-destructive text-background'
        : 'bg-background border border-border text-muted-foreground'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full ${cls}`}>
      {label}
    </span>
  )
}

export default async function BookingsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  const { tab = 'upcoming' } = await searchParams

  const admin = createAdminClient()
  const [{ upcoming, past }, access, reserved, settings] = await Promise.all([
    loadBookings(user.id),
    memberAccess(admin, user.id),
    reservedPtCount(admin, user.id),
    loadGymSettings(admin),
  ])
  const list = tab === 'past' ? past : upcoming

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Bookings</h1>
        <p className="text-muted-foreground">Your PT sessions, past and upcoming.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card border border-border rounded-[22px] p-4">
          <p className="font-stat text-4xl text-primary">
            {access.ptUnlimited ? '∞' : access.ptBalance}
          </p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
            PT left
          </p>
        </div>
        <div className="bg-card border border-border rounded-[22px] p-4">
          <p className="font-stat text-4xl">{reserved}</p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
            Reserved
          </p>
        </div>
        <div className="bg-card border border-border rounded-[22px] p-4">
          <p className="font-stat text-2xl leading-tight pt-1">
            {access.periodEnd ? fmtAstDate(access.periodEnd) : '—'}
          </p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
            {access.subscriptionStatus === 'lapsed' ? 'Lapsed' : 'Renews'}
          </p>
        </div>
      </div>

      <div className="inline-flex gap-1 p-1 bg-card border border-border rounded-full mb-4">
        {(['upcoming', 'past'] as const).map((t) => (
          <Link
            key={t}
            href={t === 'upcoming' ? '/dashboard/bookings' : '/dashboard/bookings?tab=past'}
            className={
              tab === t
                ? 'px-4 py-1.5 rounded-full bg-foreground text-background text-sm font-semibold'
                : 'px-4 py-1.5 rounded-full text-sm font-semibold text-muted-foreground'
            }
          >
            {t === 'upcoming' ? 'Upcoming' : 'Past'}
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="bg-card border border-border rounded-[22px] p-12 text-center">
          <Calendar size={32} className="mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold mb-1">
            {tab === 'upcoming' ? 'Nothing booked' : 'No past sessions yet'}
          </p>
          {tab === 'upcoming' && (
            <Link
              href="/book"
              className="inline-flex items-center gap-1 mt-3 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
            >
              Book a session
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((b) => (
            <li
              key={b.id}
              className="bg-card border border-border rounded-[22px] p-4 flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {b.coachName}
                  {tab === 'upcoming' && (
                    <span className="ml-2 text-xs font-normal text-primary">
                      {b.countdown}
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {fmtAstWeekdayDate(b.startIso)} ·{' '}
                  <span className="font-stat text-base text-foreground">
                    {fmtAstTime(b.startIso)}
                  </span>{' '}
                  – {fmtAstTime(b.endIso)}
                </p>
              </div>
              {tab === 'upcoming' ? (
                <BookingActions
                  bookingId={b.id}
                  resourceId={b.resourceId}
                  label={`${b.coachName} ${fmtAstTime(b.startIso)}`}
                  outcome={cancelOutcome(b.startIso, settings)}
                  cancelHours={settings.ptCancelHours}
                />
              ) : (
                <Badge status={b.status} checkedIn={b.checkedIn} />
              )}
            </li>
          ))}
        </ul>
      )}

      {tab === 'upcoming' && list.length > 0 && (
        <div className="mt-6">
          <Link
            href="/book"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
          >
            Book another
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}
