import Link from 'next/link'
import {
  Users,
  Calendar,
  Receipt,
  TrendingUp,
  ArrowRight,
  UserCheck,
  AlertCircle,
} from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { signedVisitorPhotoUrl } from '@/lib/photos/upload'
import { fmtAstTime } from '@/lib/time/ast'
import LiveCheckinFeed, {
  type InitialVisitRow,
} from '@/components/admin/live-checkin-feed'
import FrontDeskStatusCard from '@/components/admin/front-desk-status-card'
import { loadReceptionStatus } from '@/lib/checkin/reception-status.server'
import { type ReceptionStatusRow } from '@/lib/checkin/reception-status'

export const dynamic = 'force-dynamic'

interface OverviewStats {
  totalMembers: number
  membersSignedUpThisMonth: number
  upcomingBookingsCount: number
  paymentsThisMonthCents: number
  paymentsThisMonthCount: number
  currentlyHere: number
  pendingVoDocs: number
  nowMs: number
}

interface UpcomingBookingRow {
  id: string
  during: string
  user_id: string | null
  resource_id: string
  status: string
  resource_name: string | null
  member_name: string | null
}

interface LoadedData {
  stats: OverviewStats
  liveVisits: InitialVisitRow[]
  upcoming: UpcomingBookingRow[]
  receptionStatus: ReceptionStatusRow | null
}

async function loadOverview(): Promise<LoadedData> {
  const admin = createAdminClient()
  const nowMs = Date.now()
  const now = new Date(nowMs)
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).toISOString()
  const last12hIso = new Date(nowMs - 12 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalMembers },
    { count: signedUpThisMonth },
    { data: upcomingBookings },
    { data: paymentsThisMonth },
    { data: visitsRaw },
    { count: pendingVoDocs },
    { data: upcomingRaw },
    receptionStatus,
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('archived', false),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart),
    // Count via SQL function — PostgREST can't filter on lower(during)
    // directly, and string-range comparison gives wrong results.
    admin.rpc('admin_upcoming_bookings_count'),
    admin
      .from('payments')
      .select('amount_cents')
      .eq('status', 'succeeded')
      .gte('paid_at', monthStart),
    admin
      .from('visits')
      .select(
        'id, kind, user_id, guest_name, guest_email, reason, selfie_path, checked_in_at, checked_out_at, profiles!visits_user_id_fkey(full_name, email, selfie_path)'
      )
      .gte('checked_in_at', last12hIso)
      .order('checked_in_at', { ascending: false })
      .limit(30),
    admin
      .from('virtual_office_documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    // Upcoming list via the same SQL function — handles range bounds
    // properly and joins resources + profiles in one shot.
    admin.rpc('admin_upcoming_bookings', { within_hours: 2 }),
    // Current front-desk presence (Be Right Back status).
    loadReceptionStatus(),
  ])

  type PaymentAmount = { amount_cents: number }
  const sumCents = ((paymentsThisMonth as PaymentAmount[] | null) ?? []).reduce(
    (sum, p) => sum + (p.amount_cents ?? 0),
    0
  )

  type RawVisit = {
    id: string
    kind: 'member' | 'guest' | 'tour'
    user_id: string | null
    guest_name: string | null
    guest_email: string | null
    reason: string | null
    selfie_path: string | null
    checked_in_at: string
    checked_out_at: string | null
    profiles:
      | {
          full_name: string | null
          email: string
          selfie_path: string | null
        }
      | {
          full_name: string | null
          email: string
          selfie_path: string | null
        }[]
      | null
  }
  const visits = ((visitsRaw as RawVisit[] | null) ?? []).map((r) => ({
    ...r,
    profile: Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : r.profiles,
  }))

  // Hydrate signed selfie URLs for initial render. Fan-out keeps this
  // fast for the ~30 visits we load.
  const hydrated = await Promise.all(
    visits.map(async (v) => {
      const path = v.selfie_path ?? v.profile?.selfie_path ?? null
      const signed = path ? await signedVisitorPhotoUrl(path) : null
      return {
        id: v.id,
        kind: v.kind,
        user_id: v.user_id,
        guest_name: v.guest_name,
        guest_email: v.guest_email,
        reason: v.reason,
        selfie_path: v.selfie_path,
        checked_in_at: v.checked_in_at,
        checked_out_at: v.checked_out_at,
        display_name:
          v.profile?.full_name ??
          v.guest_name ??
          v.profile?.email ??
          v.guest_email,
        profile_email: v.profile?.email ?? null,
        profile_selfie_path: path,
        signed_selfie_url: signed,
      } satisfies InitialVisitRow
    })
  )

  // "Currently here" = visits in the last 12 hours without a checkout.
  const currentlyHere = hydrated.filter((v) => !v.checked_out_at).length

  // RPC return shape: { id, during, user_id, resource_id, status,
  // full_name, email, guest_name, resource_name }. Fall back to
  // guest_name for admin-on-behalf bookings.
  type RpcBooking = {
    id: string
    during: string
    user_id: string | null
    resource_id: string
    status: string
    full_name: string | null
    email: string | null
    guest_name: string | null
    resource_name: string | null
  }
  const upcoming: UpcomingBookingRow[] = (
    (upcomingRaw as RpcBooking[] | null) ?? []
  ).map((b) => ({
    id: b.id,
    during: b.during,
    user_id: b.user_id,
    resource_id: b.resource_id,
    status: b.status,
    resource_name: b.resource_name ?? b.resource_id,
    member_name: b.full_name ?? b.guest_name ?? b.email ?? null,
  }))

  return {
    stats: {
      totalMembers: totalMembers ?? 0,
      membersSignedUpThisMonth: signedUpThisMonth ?? 0,
      upcomingBookingsCount:
        typeof upcomingBookings === 'number' ? upcomingBookings : 0,
      paymentsThisMonthCents: sumCents,
      paymentsThisMonthCount: paymentsThisMonth?.length ?? 0,
      currentlyHere,
      pendingVoDocs: pendingVoDocs ?? 0,
      nowMs,
    },
    liveVisits: hydrated,
    upcoming,
    receptionStatus,
  }
}

function StatTile({
  title,
  value,
  subtext,
  href,
  icon,
  highlight,
}: {
  title: string
  value: string
  subtext?: string
  href: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className={
        highlight
          ? 'group block bg-darkBlue-900 text-white border border-darkBlue-900 rounded-lg p-6 hover:bg-darkBlue-800 transition'
          : 'group block bg-white border border-neutral-200 rounded-lg p-6 hover:border-darkBlue-900 hover:shadow-sm transition'
      }
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={
            highlight
              ? 'w-10 h-10 rounded-md bg-white/10 text-white flex items-center justify-center'
              : 'w-10 h-10 rounded-md bg-darkBlue-50 text-darkBlue-900 flex items-center justify-center'
          }
        >
          {icon}
        </div>
        <ArrowRight
          size={16}
          className={
            highlight
              ? 'text-white/60 group-hover:text-white transition'
              : 'text-neutral-400 group-hover:text-darkBlue-900 transition'
          }
        />
      </div>
      <p
        className={
          highlight
            ? 'text-xs uppercase tracking-wide text-white/70 mb-1'
            : 'text-xs uppercase tracking-wide text-neutral-500 mb-1'
        }
      >
        {title}
      </p>
      <p className="font-heading text-3xl">{value}</p>
      {subtext && (
        <p
          className={
            highlight
              ? 'text-xs text-white/70 mt-1'
              : 'text-xs text-neutral-500 mt-1'
          }
        >
          {subtext}
        </p>
      )}
    </Link>
  )
}

function formatTtd(cents: number): string {
  return `TTD $${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function bookingTime(during: string, nowMs: number): string {
  // Postgres tstzrange comes back as `[start,end)` strings. Pull the
  // start out.
  const match = during.match(/^[[(]"?([^",)]*)"?,/)
  if (!match) return ''
  const startMs = new Date(match[1]).getTime()
  const minsAway = Math.round((startMs - nowMs) / 60000)
  const time = fmtAstTime(startMs)
  if (minsAway <= 0) return `${time} · now`
  if (minsAway < 60) return `${time} · in ${minsAway}m`
  return time
}

export default async function AdminOverviewPage() {
  const { stats, liveVisits, upcoming, receptionStatus } = await loadOverview()

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-turquoise-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-turquoise-500" />
          </span>
          <p className="text-xs uppercase tracking-wide text-turquoise-700 font-medium">
            Live overview
          </p>
        </div>
        <h1 className="font-heading text-3xl mb-1">Mission control</h1>
        <p className="text-neutral-600">
          Everything happening at The Worx right now. Arrivals appear in real
          time as people check in.
        </p>
      </div>

      {/* Top stats — currently-here is the lead tile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile
          title="Currently here"
          value={stats.currentlyHere.toString()}
          subtext="Checked in, not yet checked out"
          href="/admin/checkin/visits"
          icon={<UserCheck size={20} />}
          highlight
        />
        <StatTile
          title="Active members"
          value={stats.totalMembers.toString()}
          subtext={
            stats.membersSignedUpThisMonth > 0
              ? `+${stats.membersSignedUpThisMonth} this month`
              : undefined
          }
          href="/admin/members"
          icon={<Users size={20} />}
        />
        <StatTile
          title="Bookings ahead"
          value={stats.upcomingBookingsCount.toString()}
          subtext="Confirmed or held"
          href="/admin/bookings"
          icon={<Calendar size={20} />}
        />
        <StatTile
          title="Revenue (month)"
          value={formatTtd(stats.paymentsThisMonthCents)}
          subtext={`${stats.paymentsThisMonthCount} payments · full tracker`}
          href="/admin/finance"
          icon={<TrendingUp size={20} />}
        />
      </div>

      {/* Live feed + upcoming bookings side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-6">
        <LiveCheckinFeed
          initial={liveVisits}
          signedInUrlsValidForMinutes={10}
        />

        <div className="space-y-6">
          <FrontDeskStatusCard initial={receptionStatus} />

          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200">
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                Next 2 hours
              </p>
              <h2 className="font-heading text-lg">Upcoming bookings</h2>
            </div>
            {upcoming.length === 0 ? (
              <p className="p-6 text-sm text-neutral-500">
                Nothing booked in the next 2 hours.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {upcoming.map((b) => (
                  <li key={b.id} className="px-5 py-3">
                    <p className="text-sm font-medium truncate">
                      {b.resource_name}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">
                      {b.member_name ?? 'Member'} ·{' '}
                      {bookingTime(b.during, stats.nowMs)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-5">
            <h2 className="font-heading text-base mb-2">
              <Receipt size={16} className="inline mr-1.5 -mt-1" />
              Quick links
            </h2>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link
                  href="/admin/payments"
                  className="text-darkBlue-900 hover:underline"
                >
                  Recent payments
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/email"
                  className="text-darkBlue-900 hover:underline"
                >
                  Broadcast email
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/catalog"
                  className="text-darkBlue-900 hover:underline"
                >
                  Catalog (plans, passes, rooms)
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/checkin"
                  className="text-darkBlue-900 hover:underline"
                >
                  Check-in devices
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
