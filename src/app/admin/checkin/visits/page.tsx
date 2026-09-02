import Link from 'next/link'
import { ChevronLeft, ChevronRight, User as UserIcon } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { signedVisitorPhotoUrl } from '@/lib/photos/upload'
import {
  fmtAstDateTime,
  astStartOfDay,
  astEndOfDay,
  astTodayKey,
} from '@/lib/time/ast'
import AdminCheckoutVisitButton from '@/components/admin/admin-checkout-visit-button'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Visits — Admin',
}

interface VisitRow {
  id: string
  kind: 'member' | 'guest' | 'tour'
  user_id: string | null
  guest_name: string | null
  guest_email: string | null
  reason: string | null
  selfie_path: string | null
  checked_in_at: string
  checked_out_at: string | null
  profiles: {
    full_name: string | null
    email: string
    selfie_path: string | null
  } | null
}

async function loadVisits(dateKey: string | null): Promise<{
  visits: (VisitRow & { isHere: boolean; selfieUrl: string | null })[]
  hereCount: number
}> {
  const admin = createAdminClient()
  const nowMs = Date.now()
  const hereCutoff = nowMs - 12 * 60 * 60 * 1000

  // Default view: rolling last month. With ?date=YYYY-MM-DD, exactly
  // that AST day — lets the team walk back through history day by day.
  let query = admin
    .from('visits')
    .select(
      'id, kind, user_id, guest_name, guest_email, reason, selfie_path, checked_in_at, checked_out_at, profiles!visits_user_id_fkey(full_name, email, selfie_path)'
    )
  if (dateKey) {
    const day = new Date(`${dateKey}T00:00:00-04:00`)
    query = query
      .gte('checked_in_at', astStartOfDay(day).toISOString())
      .lt('checked_in_at', astEndOfDay(day).toISOString())
  } else {
    query = query.gte(
      'checked_in_at',
      new Date(nowMs - 31 * 24 * 60 * 60 * 1000).toISOString()
    )
  }
  const { data } = await query
    .order('checked_in_at', { ascending: false })
    .limit(600)
  if (!data) return { visits: [], hereCount: 0 }

  const flattened = (data as unknown as VisitRow[]).map((r) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : r.profiles,
  }))
  const visits = await Promise.all(
    flattened.map(async (v) => {
      const path = v.selfie_path ?? v.profiles?.selfie_path ?? null
      const selfieUrl = path ? await signedVisitorPhotoUrl(path) : null
      return {
        ...v,
        isHere:
          !v.checked_out_at &&
          new Date(v.checked_in_at).getTime() >= hereCutoff,
        selfieUrl,
      }
    })
  )
  return { visits, hereCount: visits.filter((v) => v.isHere).length }
}

const fmt = fmtAstDateTime

export default async function AdminVisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date: rawDate } = await searchParams
  const dateKey =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null
  const { visits, hereCount } = await loadVisits(dateKey)
  const here = visits.filter((v) => v.isHere)

  const shiftDay = (key: string, delta: number): string => {
    const d = new Date(`${key}T00:00:00-04:00`)
    d.setDate(d.getDate() + delta)
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Port_of_Spain',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  }
  const browseKey = dateKey ?? astTodayKey()

  return (
    <div className="space-y-6">
      <Link
        href="/admin/checkin"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <ChevronLeft size={16} />
        Check-in devices
      </Link>

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl mb-2">Visits</h1>
          <p className="text-sm text-neutral-600">
            {dateKey
              ? `${visits.length} visit${visits.length === 1 ? '' : 's'} on ${dateKey}`
              : `${hereCount} currently here · ${visits.length} in the last month`}
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Link
            href={`/admin/checkin/visits?date=${shiftDay(browseKey, -1)}`}
            className="p-2 rounded-md border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:border-neutral-400"
            aria-label="Previous day"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="px-3 py-2 font-medium">
            {dateKey ?? 'Last month'}
          </span>
          {dateKey && (
            <Link
              href={`/admin/checkin/visits?date=${shiftDay(browseKey, 1)}`}
              className="p-2 rounded-md border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:border-neutral-400"
              aria-label="Next day"
            >
              <ChevronRight size={16} />
            </Link>
          )}
          {dateKey && (
            <Link
              href="/admin/checkin/visits"
              className="ml-2 text-xs text-darkBlue-900 hover:underline"
            >
              Back to recent
            </Link>
          )}
        </div>
      </div>

      {!dateKey && (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="font-heading text-lg">Currently here</h2>
          </div>
          {here.length === 0 ? (
            <p className="p-6 text-sm text-neutral-500">No active visits.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {here.map((v) => (
                <li
                  key={v.id}
                  className="px-6 py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <SelfieThumb url={v.selfieUrl} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {v.profiles?.full_name ??
                          v.guest_name ??
                          v.profiles?.email ??
                          v.guest_email ??
                          'Unknown'}
                      </p>
                      <p className="text-xs text-neutral-500 truncate">
                        {v.kind} · checked in {fmt(v.checked_in_at)}
                        {v.reason ? ` · ${v.reason}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-turquoise-100 text-turquoise-800 capitalize">
                      {v.kind}
                    </span>
                    <AdminCheckoutVisitButton visitId={v.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="font-heading text-lg">
            {dateKey ? `Visits on ${dateKey}` : 'Last month'}
          </h2>
        </div>
        <ul className="divide-y divide-neutral-100">
          {visits.map((v) => (
            <li
              key={v.id}
              className="px-6 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <SelfieThumb url={v.selfieUrl} />
                <div className="min-w-0">
                  <p className="text-sm truncate">
                    {v.profiles?.full_name ??
                      v.guest_name ??
                      v.profiles?.email ??
                      v.guest_email ??
                      'Unknown'}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">
                    {fmt(v.checked_in_at)}
                    {v.reason ? ` · ${v.reason}` : ''}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 capitalize shrink-0">
                {v.kind}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function SelfieThumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center shrink-0">
        <UserIcon size={18} />
      </div>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block w-10 h-10 rounded-full overflow-hidden bg-neutral-100 shrink-0"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Visitor" className="w-full h-full object-cover" />
    </a>
  )
}
