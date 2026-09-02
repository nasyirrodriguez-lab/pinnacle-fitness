import Link from 'next/link'
import { requireCoach } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/utils/supabase/admin'
import { parseTstzRange } from '@/lib/booking/slots'
import { floorStatus } from '@/lib/gym/floor'
import { buildCoachDayGrid, type AvailabilityWindow } from '@/lib/coaches/availability'
import { astStartOfDay, astEndOfDay, astDateKey, fmtAstTime } from '@/lib/time/ast'
import CoachSessionButtons from '@/components/admin/coach-session-buttons'

export const metadata = { title: 'Today — Coach' }

interface SessionRow {
  id: string
  startIso: string
  endIso: string
  memberName: string
  memberId: string | null
  status: string
  checkedIn: boolean
}

function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Port_of_Spain',
    weekday: 'short',
    day: 'numeric',
  }).format(d)
}

export default async function CoachTodayPage() {
  const coach = await requireCoach()
  const admin = createAdminClient()

  const { data: coachRow } = await admin
    .from('coaches')
    .select('display_name, group_cap, slug')
    .eq('id', coach.coachId)
    .maybeSingle()
  const c = (coachRow as { display_name: string; group_cap: number; slug: string } | null) ?? {
    display_name: coach.fullName ?? 'Coach',
    group_cap: 6,
    slug: '',
  }
  const resourceId = `pt-${c.slug}`

  const now = new Date()
  const weekStart = astStartOfDay(now)
  const weekEnd = astEndOfDay(new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000))

  const [{ data: bookingRows }, { data: availRows }, { data: blockRows }, floor, { data: onFloorRows }] =
    await Promise.all([
      admin
        .from('bookings')
        .select('id, user_id, during, status, checked_in_at, profiles!bookings_user_id_fkey(full_name, email)')
        .eq('resource_id', resourceId)
        .in('status', ['confirmed', 'completed', 'no_show'])
        .gte('during', `[${weekStart.toISOString()},)`)
        .lt('during', `[${weekEnd.toISOString()},)`)
        .order('during', { ascending: true }),
      admin.from('coach_availability').select('weekday, start_minute, end_minute').eq('coach_id', coach.coachId),
      admin
        .from('coach_blocks')
        .select('starts_at, ends_at, reason')
        .eq('coach_id', coach.coachId)
        .gte('ends_at', weekStart.toISOString()),
      floorStatus(admin),
      admin
        .from('visits')
        .select('id, kind, checked_in_at, reason, profiles!visits_user_id_fkey(full_name, email)')
        .in('kind', ['pt', 'open_gym'])
        .is('checked_out_at', null)
        .order('checked_in_at', { ascending: false })
        .limit(30),
    ])

  type Raw = {
    id: string
    user_id: string | null
    during: string
    status: string
    checked_in_at: string | null
    profiles: { full_name?: string | null; email?: string } | { full_name?: string | null; email?: string }[] | null
  }
  const all: SessionRow[] = ((bookingRows as Raw[] | null) ?? [])
    .map((r) => {
      const range = parseTstzRange(r.during)
      const p = Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : r.profiles
      return range
        ? {
            id: r.id,
            startIso: range.during_lower,
            endIso: range.during_upper,
            memberName: p?.full_name?.trim() || p?.email || 'Member',
            memberId: r.user_id,
            status: r.status,
            checkedIn: Boolean(r.checked_in_at),
          }
        : null
    })
    .filter((x): x is SessionRow => x !== null)

  const todayKey = astDateKey(now)
  const today = all.filter((s) => astDateKey(s.startIso) === todayKey)
  // Group by hour so a small-group slot reads as one line with a headcount.
  const byHour = new Map<string, SessionRow[]>()
  for (const s of today) {
    const list = byHour.get(s.startIso) ?? []
    list.push(s)
    byHour.set(s.startIso, list)
  }

  const availability: AvailabilityWindow[] = ((availRows as
    | { weekday: number; start_minute: number; end_minute: number }[]
    | null) ?? []).map((w) => ({ weekday: w.weekday, startMinute: w.start_minute, endMinute: w.end_minute }))
  const blocks = ((blockRows as { starts_at: string; ends_at: string; reason: string | null }[] | null) ?? []).map(
    (b) => ({ startsAt: b.starts_at, endsAt: b.ends_at, reason: b.reason })
  )

  // Week strip: for each of the next 7 days, open hours vs hours with ≥1 booking.
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000)
    const key = astDateKey(d)
    const dayBookings = all.filter((s) => astDateKey(s.startIso) === key && s.status !== 'no_show')
    const grid = buildCoachDayGrid({
      dateKey: key,
      availability,
      blocks,
      bookings: dayBookings.map((b) => ({ startIso: b.startIso, endIso: b.endIso, userId: b.memberId })),
      capacity: c.group_cap,
      currentUserId: null,
      now: 0,
    })
    const open = grid.length
    const booked = grid.filter((g) => g.booked > 0).length
    return { key, label: dayLabel(d), open, booked, people: dayBookings.length }
  })
  const weekOpen = week.reduce((s, d) => s + d.open, 0)
  const weekBooked = week.reduce((s, d) => s + d.booked, 0)
  const fill = weekOpen === 0 ? 0 : Math.round((weekBooked / weekOpen) * 100)

  type VisitRaw = {
    id: string
    kind: string
    checked_in_at: string
    reason: string | null
    profiles: { full_name?: string | null; email?: string } | { full_name?: string | null; email?: string }[] | null
  }
  const onFloor = ((onFloorRows as VisitRaw[] | null) ?? []).map((v) => {
    const p = Array.isArray(v.profiles) ? (v.profiles[0] ?? null) : v.profiles
    return {
      id: v.id,
      name: p?.full_name?.trim() || p?.email || 'Member',
      kind: v.kind,
      since: v.checked_in_at,
    }
  })

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-turquoise-700 font-medium mb-1">Coach view</p>
        <h1 className="font-heading text-3xl mb-1">Today, {c.display_name}</h1>
        <p className="text-neutral-600">
          Your sessions in order. Mark each one delivered or a no-show once it&apos;s done — that&apos;s what your earnings count.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-turquoise-500 text-black rounded-lg p-5">
          <p className="text-xs uppercase tracking-wide opacity-70 mb-1">Sessions today</p>
          <p className="font-stat text-4xl">{byHour.size}</p>
          <p className="text-xs opacity-70 mt-1">{today.length} people booked</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">This week</p>
          <p className="font-stat text-4xl text-turquoise-700">{fill}%</p>
          <p className="text-xs text-neutral-500 mt-1">{weekBooked} of {weekOpen} open hours booked</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">On the floor now</p>
          <p className="font-stat text-4xl">
            {floor.onFloor}
            <span className="font-sans text-base text-neutral-500"> / {floor.cap}</span>
          </p>
          <p className="text-xs text-neutral-500 mt-1">{floor.isFull ? 'Full — cap hit' : `${floor.spaceLeft} spots free`}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="font-heading text-lg">Today&apos;s sessions</h2>
            <Link href="/admin/bookings/new" className="text-xs font-medium text-turquoise-700 hover:underline">
              Book someone in
            </Link>
          </div>
          {byHour.size === 0 ? (
            <p className="p-6 text-sm text-neutral-500">Nothing booked today. Enjoy the quiet — or check the floor.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {[...byHour.entries()].map(([startIso, people]) => (
                <li key={startIso} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="font-stat text-2xl">
                      {fmtAstTime(startIso)}
                      <span className="font-sans text-sm text-neutral-500 ml-2">
                        {people.length} of {c.group_cap}
                      </span>
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {people.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          {p.memberId ? (
                            <Link href={`/admin/members/${p.memberId}`} className="font-medium truncate hover:underline">
                              {p.memberName}
                            </Link>
                          ) : (
                            <span className="font-medium truncate">{p.memberName}</span>
                          )}
                          {p.checkedIn && (
                            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded bg-lime-100 text-lime-900">IN</span>
                          )}
                          {p.status === 'completed' && (
                            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded bg-lime-100 text-lime-900">DELIVERED</span>
                          )}
                          {p.status === 'no_show' && (
                            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-100 text-red-700">NO-SHOW</span>
                          )}
                        </span>
                        {p.status === 'confirmed' && <CoachSessionButtons bookingId={p.id} />}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="bg-white border border-neutral-200 rounded-lg p-5">
            <h2 className="font-heading text-base mb-3">Next 7 days</h2>
            <ul className="space-y-2">
              {week.map((d) => (
                <li key={d.key} className="flex items-center gap-3 text-sm">
                  <span className="w-14 text-neutral-500">{d.label}</span>
                  <span className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <span
                      className="block h-full bg-turquoise-500 rounded-full"
                      style={{ width: `${d.open ? Math.round((d.booked / d.open) * 100) : 0}%` }}
                    />
                  </span>
                  <span className="font-stat text-sm w-14 text-right">
                    {d.booked}/{d.open}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/coach/availability" className="block mt-3 text-xs text-turquoise-700 hover:underline">
              Edit availability
            </Link>
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg p-5">
            <h2 className="font-heading text-base mb-3">On the floor</h2>
            {onFloor.length === 0 ? (
              <p className="text-sm text-neutral-500">Nobody scanned in right now.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {onFloor.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{v.name}</span>
                    <span className="text-xs text-neutral-500 shrink-0">
                      {v.kind === 'pt' ? 'PT' : 'Open gym'} · {fmtAstTime(v.since)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
