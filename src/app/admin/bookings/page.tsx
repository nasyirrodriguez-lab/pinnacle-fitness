import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'
import { parseTstzRange } from '@/lib/booking/slots'
import { cn } from '@/lib/utils'
import { astDateKey, astStartOfDay, fmtAstTime, fmtAstWeekdayDate } from '@/lib/time/ast'
import AdminCancelBookingButton from '@/components/admin/admin-cancel-booking-button'
import CoachSessionButtons from '@/components/admin/coach-session-buttons'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sessions — Admin' }

interface PageProps {
  searchParams: Promise<{ when?: string; coach?: string }>
}

interface Row {
  id: string
  startIso: string
  resourceId: string
  coachName: string
  memberId: string | null
  memberName: string
  status: string
  checkedIn: boolean
}

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-turquoise-50 text-turquoise-700',
  completed: 'bg-lime-100 text-lime-900',
  no_show: 'bg-red-100 text-red-700',
  cancelled: 'bg-neutral-200 text-neutral-700',
}

async function loadSessions(when: 'upcoming' | 'past', coach: string | null): Promise<Row[]> {
  const admin = createAdminClient()
  const todayStart = astStartOfDay(new Date()).toISOString()
  let q = admin
    .from('bookings')
    .select('id, user_id, during, status, checked_in_at, resource_id, resources(name), profiles!bookings_user_id_fkey(full_name, email)')
    .in('resource_id', ['pt-nasyir', 'pt-matthew'])
  if (coach) q = q.eq('resource_id', `pt-${coach}`)
  q = when === 'upcoming'
    ? q.gte('during', `[${todayStart},)`).in('status', ['confirmed', 'completed', 'no_show']).order('during', { ascending: true })
    : q.lt('during', `[${todayStart},)`).order('during', { ascending: false })
  const { data } = await q.limit(400)
  type Raw = {
    id: string
    user_id: string | null
    during: string
    status: string
    checked_in_at: string | null
    resource_id: string
    resources: { name?: string } | { name?: string }[] | null
    profiles: { full_name?: string | null; email?: string } | { full_name?: string | null; email?: string }[] | null
  }
  return ((data as Raw[] | null) ?? [])
    .map((r) => {
      const range = parseTstzRange(r.during)
      const res = Array.isArray(r.resources) ? (r.resources[0] ?? null) : r.resources
      const p = Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : r.profiles
      return range
        ? {
            id: r.id,
            startIso: range.during_lower,
            resourceId: r.resource_id,
            coachName: res?.name ?? r.resource_id,
            memberId: r.user_id,
            memberName: p?.full_name?.trim() || p?.email || 'Member',
            status: r.status,
            checkedIn: Boolean(r.checked_in_at),
          }
        : null
    })
    .filter((x): x is Row => x !== null)
}

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn('px-3 py-1 text-sm font-medium rounded-full transition', active ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900')}
    >
      {label}
    </Link>
  )
}

export default async function AdminSessionsPage({ searchParams }: PageProps) {
  const { when: whenParam, coach: coachParam } = await searchParams
  const when = whenParam === 'past' ? 'past' : 'upcoming'
  const coach = coachParam === 'nasyir' || coachParam === 'matthew' ? coachParam : null
  const rows = await loadSessions(when, coach)

  // Group: day → hour → people, so a small group reads as one block.
  const days = new Map<string, Map<string, Row[]>>()
  for (const r of rows) {
    const day = astDateKey(r.startIso)
    const hour = `${r.startIso}|${r.resourceId}`
    if (!days.has(day)) days.set(day, new Map())
    const hours = days.get(day)!
    if (!hours.has(hour)) hours.set(hour, [])
    hours.get(hour)!.push(r)
  }
  const href = (w: string, c: string | null) => `/admin/bookings?when=${w}${c ? `&coach=${c}` : ''}`

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl mb-1">Sessions</h1>
          <p className="text-neutral-600">Every PT hour, grouped by coach and day. Settle each one delivered or no-show — that&apos;s what earnings count.</p>
        </div>
        <Link href="/admin/bookings/new" className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-full bg-turquoise-500 text-black hover:bg-turquoise-600">
          Book someone in
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="inline-flex gap-1 p-1 bg-neutral-100 rounded-full">
          <Tab href={href('upcoming', coach)} label="Upcoming" active={when === 'upcoming'} />
          <Tab href={href('past', coach)} label="Past" active={when === 'past'} />
        </div>
        <div className="inline-flex gap-1 p-1 bg-neutral-100 rounded-full">
          <Tab href={href(when, null)} label="Both coaches" active={!coach} />
          <Tab href={href(when, 'nasyir')} label="Nasyir" active={coach === 'nasyir'} />
          <Tab href={href(when, 'matthew')} label="Matthew" active={coach === 'matthew'} />
        </div>
      </div>

      {days.size === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center text-neutral-500">No sessions here.</div>
      ) : (
        <div className="space-y-6">
          {[...days.entries()].map(([day, hours]) => (
            <section key={day} className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50">
                <h2 className="font-heading text-base">{fmtAstWeekdayDate(`${day}T12:00:00-04:00`)}</h2>
              </div>
              <ul className="divide-y divide-neutral-100">
                {[...hours.entries()].map(([key, people]) => {
                  const first = people[0]
                  return (
                    <li key={key} className="px-5 py-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-stat text-2xl">{fmtAstTime(first.startIso)}</span>
                        <span className={cn('inline-flex px-2 py-0.5 text-xs font-semibold rounded-full', first.resourceId === 'pt-nasyir' ? 'bg-turquoise-500 text-black' : 'bg-white text-neutral-900 border border-neutral-300')}>
                          {first.coachName}
                        </span>
                        <span className="text-xs text-neutral-500">{people.length} booked</span>
                      </div>
                      <ul className="space-y-1.5">
                        {people.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex items-center gap-2 min-w-0">
                              {p.memberId ? (
                                <Link href={`/admin/members/${p.memberId}`} className="font-medium hover:underline truncate">{p.memberName}</Link>
                              ) : (
                                <span className="font-medium truncate">{p.memberName}</span>
                              )}
                              <span className={cn('inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase', STATUS_STYLE[p.status] ?? 'bg-neutral-100')}>
                                {p.status.replace('_', ' ')}
                              </span>
                              {p.checkedIn && p.status === 'confirmed' && (
                                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded bg-lime-100 text-lime-900">IN</span>
                              )}
                            </span>
                            {p.status === 'confirmed' && (
                              <span className="flex items-center gap-2 shrink-0">
                                <CoachSessionButtons bookingId={p.id} />
                                <AdminCancelBookingButton bookingId={p.id} />
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
