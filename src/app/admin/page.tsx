import Link from 'next/link'
import { Users, Calendar, TrendingUp, UserCheck, ArrowRight, ClipboardList } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { signedVisitorPhotoUrl } from '@/lib/photos/upload'
import { floorStatus } from '@/lib/gym/floor'
import { loadGymSettings } from '@/lib/gym/settings'
import { astMonthBounds, astMonthKey, coachDelivery, fmtTtd } from '@/lib/members/earnings'
import { astStartOfDay, fmtAstTime } from '@/lib/time/ast'
import { parseTstzRange } from '@/lib/booking/slots'
import LiveCheckinFeed, { type InitialVisitRow } from '@/components/admin/live-checkin-feed'
import FrontDeskStatusCard from '@/components/admin/front-desk-status-card'
import { loadReceptionStatus } from '@/lib/checkin/reception-status.server'

export const dynamic = 'force-dynamic'

async function loadOverview() {
  const admin = createAdminClient()
  const now = new Date()
  const monthKey = astMonthKey(now)
  const { fromIso: monthStart, toIso: monthEnd } = astMonthBounds(monthKey)
  const todayStart = astStartOfDay(now).toISOString()
  const last12h = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString()

  const [
    { count: activeMembers },
    { count: newMembers },
    { count: openApplications },
    { data: payments },
    { data: visitsRaw },
    { data: todayBookings },
    floor,
    settings,
    nasyir,
    matthew,
    { data: shopSales },
    { data: pool },
    receptionStatus,
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('archived', false).eq('role', 'member'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'member').gte('created_at', monthStart),
    admin.from('applications').select('id', { count: 'exact', head: true }).in('status', ['new', 'intro_booked', 'waitlisted']),
    admin.from('payments').select('amount_cents').eq('status', 'succeeded').gte('paid_at', monthStart).lt('paid_at', monthEnd),
    admin
      .from('visits')
      .select('id, kind, user_id, guest_name, guest_email, reason, selfie_path, checked_in_at, checked_out_at, profiles!visits_user_id_fkey(full_name, email, selfie_path)')
      .gte('checked_in_at', last12h)
      .order('checked_in_at', { ascending: false })
      .limit(30),
    admin
      .from('bookings')
      .select('id, during, resource_id, status, checked_in_at, resources(name), profiles!bookings_user_id_fkey(full_name, email)')
      .in('resource_id', ['pt-nasyir', 'pt-matthew'])
      .eq('status', 'confirmed')
      .gte('during', `[${todayStart},)`)
      .order('during', { ascending: true })
      .limit(40),
    floorStatus(admin),
    loadGymSettings(admin),
    coachDelivery(admin, { resourceId: 'pt-nasyir', fromIso: monthStart, toIso: monthEnd }),
    coachDelivery(admin, { resourceId: 'pt-matthew', fromIso: monthStart, toIso: monthEnd }),
    admin.from('sales').select('total_cents').gte('created_at', monthStart).lt('created_at', monthEnd),
    admin.from('pool_contributions').select('amount_cents').eq('month', `${monthKey}-01`),
    loadReceptionStatus(),
  ])

  const collected = ((payments as { amount_cents: number }[] | null) ?? []).reduce((s, p) => s + p.amount_cents, 0)
  const shop = ((shopSales as { total_cents: number }[] | null) ?? []).reduce((s, p) => s + p.total_cents, 0)
  const poolIn = ((pool as { amount_cents: number }[] | null) ?? []).reduce((s, p) => s + p.amount_cents, 0)

  type RawVisit = {
    id: string; kind: string; user_id: string | null; guest_name: string | null; guest_email: string | null; reason: string | null
    selfie_path: string | null; checked_in_at: string; checked_out_at: string | null
    profiles: { full_name: string | null; email: string; selfie_path: string | null } | { full_name: string | null; email: string; selfie_path: string | null }[] | null
  }
  const liveVisits = await Promise.all(
    ((visitsRaw as RawVisit[] | null) ?? []).map(async (v) => {
      const profile = Array.isArray(v.profiles) ? (v.profiles[0] ?? null) : v.profiles
      const path = v.selfie_path ?? profile?.selfie_path ?? null
      return {
        id: v.id, kind: v.kind as InitialVisitRow['kind'], user_id: v.user_id, guest_name: v.guest_name, guest_email: v.guest_email, reason: v.reason,
        selfie_path: v.selfie_path, checked_in_at: v.checked_in_at, checked_out_at: v.checked_out_at,
        display_name: profile?.full_name ?? v.guest_name ?? profile?.email ?? v.guest_email,
        profile_email: profile?.email ?? null, profile_selfie_path: path,
        signed_selfie_url: path ? await signedVisitorPhotoUrl(path) : null,
      } satisfies InitialVisitRow
    })
  )

  type RawBooking = {
    id: string; during: string; resource_id: string; checked_in_at: string | null
    resources: { name?: string } | { name?: string }[] | null
    profiles: { full_name?: string | null; email?: string } | { full_name?: string | null; email?: string }[] | null
  }
  const today = ((todayBookings as RawBooking[] | null) ?? []).map((b) => {
    const range = parseTstzRange(b.during)
    const res = Array.isArray(b.resources) ? (b.resources[0] ?? null) : b.resources
    const p = Array.isArray(b.profiles) ? (b.profiles[0] ?? null) : b.profiles
    return { id: b.id, startIso: range?.during_lower ?? '', coach: res?.name ?? b.resource_id, member: p?.full_name?.trim() || p?.email || 'Member', checkedIn: Boolean(b.checked_in_at) }
  })

  return {
    monthKey, floor, settings, liveVisits, today, receptionStatus,
    stats: {
      activeMembers: activeMembers ?? 0, newMembers: newMembers ?? 0, openApplications: openApplications ?? 0,
      collected, delivered: nasyir.totalCents + matthew.totalCents, nasyir: nasyir.totalCents, matthew: matthew.totalCents,
      shop, poolIn, poolTotal: shop + poolIn, rentTarget: settings.rentTargetCents,
    },
  }
}

function Tile({ title, value, sub, href, icon, highlight }: { title: string; value: string; sub?: string; href: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <Link href={href} className={highlight ? 'group block bg-turquoise-500 text-black rounded-lg p-5 transition hover:bg-turquoise-600' : 'group block bg-white border border-neutral-200 rounded-lg p-5 hover:border-turquoise-500 transition'}>
      <div className="flex items-start justify-between mb-2"><span className={highlight ? 'opacity-70' : 'text-turquoise-700'}>{icon}</span><ArrowRight size={16} className="opacity-40 group-hover:opacity-100" /></div>
      <p className={highlight ? 'text-xs uppercase tracking-wide opacity-70' : 'text-xs uppercase tracking-wide text-neutral-500'}>{title}</p>
      <p className="font-stat text-3xl">{value}</p>
      {sub && <p className={highlight ? 'text-xs opacity-70 mt-1' : 'text-xs text-neutral-500 mt-1'}>{sub}</p>}
    </Link>
  )
}

export default async function AdminOverviewPage() {
  const { stats, floor, liveVisits, today, receptionStatus } = await loadOverview()
  const poolShort = stats.rentTarget > 0 ? stats.rentTarget - stats.poolTotal : null

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-turquoise-700 font-medium mb-1">Business · live</p>
        <h1 className="font-heading text-3xl mb-1">Pinnacle right now</h1>
        <p className="text-neutral-600">The floor, the money and the pipeline, on one screen. Check-ins land here as they happen.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Tile title="On the floor" value={`${floor.onFloor} / ${floor.cap}`} sub={floor.isFull ? 'Full — cap hit' : `${floor.spaceLeft} spots free`} href="/admin/checkin/visits" icon={<UserCheck size={20} />} highlight />
        <Tile title="Members" value={String(stats.activeMembers)} sub={`+${stats.newMembers} this month`} href="/admin/members" icon={<Users size={20} />} />
        <Tile title="Applications" value={String(stats.openApplications)} sub="waiting on a coach" href="/admin/applications" icon={<ClipboardList size={20} />} />
        <Tile title="Sessions today" value={String(today.length)} sub={`${today.filter((t) => t.checkedIn).length} scanned in`} href="/admin/bookings" icon={<Calendar size={20} />} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Tile title="Collected this month" value={fmtTtd(stats.collected)} sub="Wam + cash, all products" href="/admin/finance" icon={<TrendingUp size={20} />} />
        <Tile title="Delivered · Nasyir" value={fmtTtd(stats.nasyir)} sub="sessions coached × value" href="/admin/finance" icon={<TrendingUp size={20} />} />
        <Tile title="Delivered · Matthew" value={fmtTtd(stats.matthew)} sub="sessions coached × value" href="/admin/finance" icon={<TrendingUp size={20} />} />
        <Tile
          title="Rent pool"
          value={fmtTtd(stats.poolTotal)}
          sub={poolShort === null ? 'set a rent target in Settings' : poolShort <= 0 ? 'covered' : `short by ${fmtTtd(poolShort)}`}
          href="/admin/finance"
          icon={<TrendingUp size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <LiveCheckinFeed initial={liveVisits} signedInUrlsValidForMinutes={10} />
        <div className="space-y-6">
          <FrontDeskStatusCard initial={receptionStatus} />
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200"><p className="text-xs uppercase tracking-wide text-neutral-500">Today</p><h2 className="font-heading text-lg">PT sessions</h2></div>
            {today.length === 0 ? <p className="p-6 text-sm text-neutral-500">No PT booked today.</p> : (
              <ul className="divide-y divide-neutral-100">
                {today.map((b) => (
                  <li key={b.id} className="px-5 py-2.5 flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0"><span className="font-medium truncate block">{b.member}</span><span className="text-xs text-neutral-500">{b.coach} · {b.startIso && fmtAstTime(b.startIso)}</span></span>
                    {b.checkedIn && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-lime-100 text-lime-900">IN</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
