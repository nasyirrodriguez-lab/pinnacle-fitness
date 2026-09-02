import Link from 'next/link'
import { redirect } from 'next/navigation'
import { QrCode, CalendarPlus, Inbox } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createAdminClient } from '@/utils/supabase/admin'
import { unreadNotificationCount } from '@/lib/notifications/notify'
import { memberAccess } from '@/lib/gym/entitlement'
import { floorStatus } from '@/lib/gym/floor'
import { nextPtBooking } from '@/lib/members/next-booking'
import { astDaysBetween, fmtAstTime, fmtAstWeekdayDate } from '@/lib/time/ast'

export const dynamic = 'force-dynamic'

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Port_of_Spain',
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
  )
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  return 'Evening'
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  const admin = createAdminClient()

  const [access, floor, next, unread] = await Promise.all([
    memberAccess(admin, user.id),
    floorStatus(admin),
    nextPtBooking(admin, user.id),
    unreadNotificationCount(admin, user.id),
  ])
  const first = (user.fullName ?? user.email).split(' ')[0].split('@')[0]

  const daysToRenew = access.periodEnd
    ? Math.max(0, astDaysBetween(access.periodEnd, new Date()))
    : null
  const planTotal = access.plan?.ptSessionsPerMonth ?? null
  const pct =
    planTotal && planTotal > 0
      ? Math.min(100, Math.round((access.ptBalance / planTotal) * 100))
      : null

  return (
    <div className="max-w-xl">
      <h1 className="heading-display text-4xl sm:text-5xl mb-6">
        {greeting()},
        <br />
        {first}.
      </h1>

      {access.subscriptionStatus === 'lapsed' && (
        <Link
          href="/dashboard/plan"
          className="block rounded-lg border border-bad/40 bg-bad/10 px-5 py-4 mb-4"
        >
          <p className="font-heading text-sm text-bad mb-0.5">
            Your plan has lapsed
          </p>
          <p className="text-sm text-ice-dim">
            {access.plan?.name ?? 'Membership'} renewal is {access.lapsedDays}{' '}
            days overdue — the iPad won’t let you in until it’s settled. Renew
            in a tap →
          </p>
        </Link>
      )}
      {access.subscriptionStatus === 'grace' && (
        <Link
          href="/dashboard/plan"
          className="block rounded-lg border border-warn/40 bg-warn/10 px-5 py-4 mb-4"
        >
          <p className="font-heading text-sm text-warn mb-0.5">
            Renewal overdue
          </p>
          <p className="text-sm text-ice-dim">
            You’re in the grace period — renew now to keep training without
            interruption →
          </p>
        </Link>
      )}

      {unread > 0 && (
        <Link
          href="/dashboard/messages"
          className="mb-4 flex items-center gap-3 rounded-full bg-card border border-border px-5 py-3"
        >
          <Inbox size={18} className="text-turf shrink-0" />
          <span className="flex-1 text-sm">
            {unread} new message{unread === 1 ? '' : 's'} from the coaches
          </span>
          <span className="text-sm text-turf font-medium">Read</span>
        </Link>
      )}

      <section className="rounded-lg bg-primary text-primary-foreground p-5 mb-4">
        <p className="text-[11px] tracking-[0.15em] uppercase opacity-70 mb-1">
          Next up
        </p>
        {next ? (
          <>
            <p className="font-heading text-2xl leading-tight">
              PT with {next.coachName}
            </p>
            <p className="text-sm opacity-80 mt-1">
              {fmtAstWeekdayDate(next.startIso)} ·{' '}
              <span className="font-stat text-lg">
                {fmtAstTime(next.startIso)}
              </span>{' '}
              · 60 min{next.checkedIn ? ' · checked in' : ''}
            </p>
            <Link
              href="/dashboard/bookings"
              className="inline-block mt-3 text-sm underline underline-offset-4"
            >
              Manage booking
            </Link>
          </>
        ) : (
          <>
            <p className="font-heading text-2xl leading-tight">
              Nothing booked
            </p>
            <p className="text-sm opacity-80 mt-1">
              Grab an hour with Nasyir or Matthew, or just scan in for open gym.
            </p>
            <Link
              href="/book"
              className="inline-flex items-center gap-2 mt-4 h-11 px-5 rounded-full bg-ground text-ice font-heading text-sm"
            >
              <CalendarPlus size={16} />
              Book a session
            </Link>
          </>
        )}
      </section>

      <section className="rounded-lg bg-card border border-border p-5 mb-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat
            value={access.ptUnlimited ? '∞' : String(access.ptBalance)}
            label="PT sessions left"
          />
          <Stat
            value={
              access.openGymUnlimited ? '∞' : String(access.openGymBalance)
            }
            label="Open-gym visits"
          />
          <Stat
            value={daysToRenew === null ? '—' : String(daysToRenew)}
            label="Days to renew"
          />
        </div>
        {pct !== null && (
          <div className="mt-4">
            <div className="h-1.5 rounded-full bg-bronze-raised overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-ice-mute mt-2">
              {access.plan?.name} · {access.ptBalance} of {planTotal} left
              {access.periodEnd && ` · renews ${fmtAstWeekdayDate(access.periodEnd)}`}
            </p>
          </div>
        )}
        {!access.plan && (
          <p className="text-xs text-ice-mute mt-4">
            No membership yet.{' '}
            <Link href="/buy" className="text-turf underline">
              Pick a plan or a pack
            </Link>
            .
          </p>
        )}
      </section>

      <div className="flex gap-3 mb-4">
        <Link
          href="/book"
          className="flex-1 h-14 rounded-full bg-primary text-primary-foreground font-heading text-sm inline-flex items-center justify-center gap-2"
        >
          <CalendarPlus size={18} />
          Book
        </Link>
        <Link
          href="/my-qr"
          className="flex-1 h-14 rounded-full border border-ice text-ice font-heading text-sm inline-flex items-center justify-center gap-2"
        >
          <QrCode size={18} />
          My QR
        </Link>
      </div>

      <p className="text-xs text-ice-mute">
        <span className="font-stat text-base text-ice">{floor.onFloor}</span>{' '}
        of {floor.cap} on the floor right now
        {floor.isFull && ' · full — the next scan-out opens a spot'}
      </p>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-stat text-3xl text-turf leading-none">{value}</p>
      <p className="text-[11px] tracking-[0.1em] uppercase text-ice-mute mt-1.5">
        {label}
      </p>
    </div>
  )
}
