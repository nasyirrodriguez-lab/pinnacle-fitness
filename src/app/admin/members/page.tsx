import Link from 'next/link'
import Image from 'next/image'
import { Search, ArrowRight, AlertCircle, User } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { signedVisitorPhotoUrl } from '@/lib/photos/upload'
import { cn } from '@/lib/utils'
import { fmtAstDate, fmtAstTime, astDaysBetween } from '@/lib/time/ast'

export const dynamic = 'force-dynamic'

// =====================================================================
// Filter + sort vocab. URL-driven, so this page is shareable and the
// admin can bookmark a view (e.g. "lapsed members on the Hot Desk plan").
// =====================================================================

const PLAN_OPTIONS = [
  { value: '', label: 'All plans' },
  { value: 'hot-desk-monthly', label: 'Hot Desk' },
  { value: 'dedicated-desk-monthly', label: 'Dedicated Desk' },
  { value: 'private-office-monthly', label: 'Private Office' },
  { value: 'corner-office-monthly', label: 'Corner Office' },
  { value: 'virtual-office-monthly', label: 'Virtual Office' },
  { value: 'passes-only', label: 'Day passes only' },
  { value: 'none', label: 'No plan or passes' },
] as const

const ONBOARDING_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'yes', label: 'Onboarded' },
  { value: 'no', label: 'Not yet onboarded' },
] as const

const RECENCY_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: 'week', label: 'Here this week' },
  { value: 'month', label: 'Here this month' },
  { value: 'lapsed', label: 'Lapsed 30+ days' },
  { value: 'never', label: 'Never visited' },
] as const

const SORT_OPTIONS = [
  { value: 'joined-desc', label: 'Joined · newest first' },
  { value: 'joined-asc', label: 'Joined · oldest first' },
  { value: 'name-asc', label: 'Name A→Z' },
  { value: 'last-visit-desc', label: 'Last visit · most recent' },
  { value: 'last-visit-asc', label: 'Last visit · longest ago' },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']
type PlanFilter = (typeof PLAN_OPTIONS)[number]['value']
type OnboardingFilter = (typeof ONBOARDING_OPTIONS)[number]['value']
type RecencyFilter = (typeof RECENCY_OPTIONS)[number]['value']

interface PageProps {
  searchParams: Promise<{
    q?: string
    page?: string
    archived?: string
    plan?: string
    onboarding?: string
    recency?: string
    sort?: string
  }>
}

interface MemberRow {
  id: string
  email: string
  fullName: string | null
  phone: string | null
  company: string | null
  role: 'member' | 'admin'
  archived: boolean
  createdAt: string
  registeredAt: string | null
  termsAcceptedAt: string | null
  planId: string | null
  planName: string | null
  passUsesRemaining: number
  lastVisitAt: string | null
  totalVisits: number
  lastSignInAt: string | null
  selfiePath: string | null
  selfieUrl: string | null
  designation: string | null
}

const PAGE_SIZE = 50

interface LoadArgs {
  q: string
  page: number
  showArchived: boolean
  plan: PlanFilter
  onboarding: OnboardingFilter
  recency: RecencyFilter
  sort: SortValue
}

async function loadMembers(
  args: LoadArgs
): Promise<{ rows: MemberRow[]; total: number; nowMs: number }> {
  const nowMs = Date.now()
  const admin = createAdminClient()

  // Step 1: load the cohort of profiles matching the basic filters
  // (search, archived, onboarding, role). We sort + paginate after the
  // join-derived enrichments so the visit-recency + plan filters can
  // filter the same set.
  let baseQuery = admin
    .from('profiles')
    .select(
      'id, email, full_name, phone, company, role, designation, archived, created_at, registered_at, terms_accepted_at, selfie_path'
    )

  if (!args.showArchived) {
    baseQuery = baseQuery.eq('archived', false)
  }
  if (args.onboarding === 'yes') {
    baseQuery = baseQuery.not('terms_accepted_at', 'is', null)
  } else if (args.onboarding === 'no') {
    baseQuery = baseQuery.is('terms_accepted_at', null)
  }
  if (args.q.trim().length > 0) {
    const term = `%${args.q.trim()}%`
    baseQuery = baseQuery.or(
      `email.ilike.${term},full_name.ilike.${term},company.ilike.${term}`
    )
  }

  // Pull everyone matching the basic filters. We do the plan/recency
  // filters in memory after the join lookups below. This is fine while
  // the member list is in the low thousands — we can switch to a
  // server-side view if it grows.
  const { data: profilesData, error } = await baseQuery.limit(5000)
  if (error || !profilesData) return { rows: [], total: 0, nowMs }

  type ProfileRaw = Record<string, unknown>
  const profiles = profilesData as ProfileRaw[]
  if (profiles.length === 0) return { rows: [], total: 0, nowMs }
  const ids = profiles.map((p) => p.id as string)

  // Step 2: fan out join lookups in parallel.
  const [
    { data: subsData },
    { data: passesData },
    { data: visitsData },
    { data: plansData },
  ] = await Promise.all([
    admin
      .from('subscriptions')
      .select('user_id, plan_id, status, current_period_end')
      .in('user_id', ids)
      .in('status', ['active', 'past_due', 'paused']),
    admin
      .from('pass_purchases')
      .select('user_id, uses_remaining, expires_at')
      .in('user_id', ids)
      .gt('uses_remaining', 0),
    admin
      .from('visits')
      .select('user_id, checked_in_at')
      .in('user_id', ids)
      .order('checked_in_at', { ascending: false }),
    admin.from('plans').select('id, name'),
  ])

  const planNameById = new Map<string, string>(
    ((plansData as Array<{ id: string; name: string }> | null) ?? []).map(
      (r) => [r.id, r.name]
    )
  )

  // Pick the most recently-active subscription per user.
  const subByUser = new Map<string, { planId: string; periodEnd: string }>()
  for (const row of (subsData as Array<{
    user_id: string
    plan_id: string
    current_period_end: string
  }> | null) ?? []) {
    const existing = subByUser.get(row.user_id)
    if (
      !existing ||
      new Date(row.current_period_end).getTime() >
        new Date(existing.periodEnd).getTime()
    ) {
      subByUser.set(row.user_id, {
        planId: row.plan_id,
        periodEnd: row.current_period_end,
      })
    }
  }

  const nowIso = new Date().toISOString()
  const passesByUser = new Map<string, number>()
  for (const row of (passesData as Array<{
    user_id: string
    uses_remaining: number
    expires_at: string
  }> | null) ?? []) {
    if (row.expires_at < nowIso) continue
    passesByUser.set(
      row.user_id,
      (passesByUser.get(row.user_id) ?? 0) + row.uses_remaining
    )
  }

  // Visits arrive ordered desc, so the first hit per user is the most
  // recent. Also count total visits as we go.
  const lastVisitByUser = new Map<string, string>()
  const totalVisitsByUser = new Map<string, number>()
  for (const row of (visitsData as Array<{
    user_id: string
    checked_in_at: string
  }> | null) ?? []) {
    if (!lastVisitByUser.has(row.user_id)) {
      lastVisitByUser.set(row.user_id, row.checked_in_at)
    }
    totalVisitsByUser.set(
      row.user_id,
      (totalVisitsByUser.get(row.user_id) ?? 0) + 1
    )
  }

  // Step 3: enrich + apply plan/recency filters in memory.
  const weekMs = nowMs - 7 * 24 * 60 * 60 * 1000
  const monthMs = nowMs - 30 * 24 * 60 * 60 * 1000

  let enriched: MemberRow[] = profiles.map((r) => {
    const id = r.id as string
    const sub = subByUser.get(id) ?? null
    const passUses = passesByUser.get(id) ?? 0
    return {
      id,
      email: r.email as string,
      fullName: (r.full_name as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      company: (r.company as string | null) ?? null,
      role: ((r.role as string) ?? 'member') as 'member' | 'admin',
      archived: (r.archived as boolean) ?? false,
      createdAt: r.created_at as string,
      registeredAt: (r.registered_at as string | null) ?? null,
      termsAcceptedAt: (r.terms_accepted_at as string | null) ?? null,
      planId: sub?.planId ?? null,
      planName: sub ? (planNameById.get(sub.planId) ?? sub.planId) : null,
      passUsesRemaining: passUses,
      lastVisitAt: lastVisitByUser.get(id) ?? null,
      totalVisits: totalVisitsByUser.get(id) ?? 0,
      lastSignInAt: null,
      selfiePath: (r.selfie_path as string | null) ?? null,
      designation: (r.designation as string | null) ?? null,
      selfieUrl: null,
    }
  })

  // Plan filter
  if (args.plan === 'none') {
    enriched = enriched.filter((m) => !m.planId && m.passUsesRemaining === 0)
  } else if (args.plan === 'passes-only') {
    enriched = enriched.filter((m) => !m.planId && m.passUsesRemaining > 0)
  } else if (args.plan) {
    enriched = enriched.filter((m) => m.planId === args.plan)
  }

  // Visit recency
  if (args.recency === 'week') {
    enriched = enriched.filter(
      (m) => m.lastVisitAt && new Date(m.lastVisitAt).getTime() >= weekMs
    )
  } else if (args.recency === 'month') {
    enriched = enriched.filter(
      (m) => m.lastVisitAt && new Date(m.lastVisitAt).getTime() >= monthMs
    )
  } else if (args.recency === 'lapsed') {
    enriched = enriched.filter(
      (m) => m.lastVisitAt && new Date(m.lastVisitAt).getTime() < monthMs
    )
  } else if (args.recency === 'never') {
    enriched = enriched.filter((m) => !m.lastVisitAt)
  }

  // Sort
  enriched.sort((a, b) => {
    switch (args.sort) {
      case 'joined-asc': {
        const aT = new Date(a.registeredAt ?? a.createdAt).getTime()
        const bT = new Date(b.registeredAt ?? b.createdAt).getTime()
        return aT - bT
      }
      case 'name-asc':
        return (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email)
      case 'last-visit-desc': {
        const aT = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : 0
        const bT = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : 0
        return bT - aT
      }
      case 'last-visit-asc': {
        // Members who've never visited go last when sorting "longest ago"
        // (otherwise they always win that sort, which is unhelpful).
        const aT = a.lastVisitAt
          ? new Date(a.lastVisitAt).getTime()
          : Number.POSITIVE_INFINITY
        const bT = b.lastVisitAt
          ? new Date(b.lastVisitAt).getTime()
          : Number.POSITIVE_INFINITY
        return aT - bT
      }
      case 'joined-desc':
      default: {
        const aT = new Date(a.registeredAt ?? a.createdAt).getTime()
        const bT = new Date(b.registeredAt ?? b.createdAt).getTime()
        return bT - aT
      }
    }
  })

  const total = enriched.length
  const from = (args.page - 1) * PAGE_SIZE
  const slice = enriched.slice(from, from + PAGE_SIZE)

  // Hydrate last sign-in + selfie URLs for the visible slice only —
  // pulled from auth.users (profiles.last_access_at is never written)
  // and Supabase Storage (selfie_path needs a short-lived signed URL).
  // Parallel per-user lookups; slice is at most PAGE_SIZE so bounded.
  await Promise.all(
    slice.map(async (m) => {
      const [authRes, signed] = await Promise.all([
        admin.auth.admin.getUserById(m.id),
        m.selfiePath
          ? signedVisitorPhotoUrl(m.selfiePath)
          : Promise.resolve(null),
      ])
      m.lastSignInAt =
        (authRes.data?.user?.last_sign_in_at as string | null) ?? null
      m.selfieUrl = signed
    })
  )

  return { rows: slice, total, nowMs }
}

const fmtDate = fmtAstDate

function relTime(iso: string | null, nowMs: number): string {
  if (!iso) return 'Never'
  // Day comparison in AST so "today" doesn't flip to "yesterday" because
  // the UTC server happens to have crossed midnight.
  const days = astDaysBetween(nowMs, iso)
  const clock = fmtAstTime(iso)
  if (days <= 0) return `Today ${clock}`
  if (days === 1) return `Yesterday ${clock}`
  if (days < 7) return `${days}d ago, ${clock}`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function nextSearchParams(
  current: {
    q: string
    showArchived: boolean
    plan: string
    onboarding: string
    recency: string
    sort: string
  },
  page: number
): URLSearchParams {
  const params = new URLSearchParams()
  if (current.q) params.set('q', current.q)
  if (current.showArchived) params.set('archived', '1')
  if (current.plan) params.set('plan', current.plan)
  if (current.onboarding) params.set('onboarding', current.onboarding)
  if (current.recency) params.set('recency', current.recency)
  if (current.sort && current.sort !== 'joined-desc') {
    params.set('sort', current.sort)
  }
  if (page > 1) params.set('page', String(page))
  return params
}

export default async function AdminMembersPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const q = sp.q ?? ''
  const pageStr = sp.page ?? '1'
  const page = Math.max(1, Number.parseInt(pageStr, 10) || 1)
  const showArchived = sp.archived === '1'
  const plan = (sp.plan ?? '') as PlanFilter
  const onboarding = (sp.onboarding ?? '') as OnboardingFilter
  const recency = (sp.recency ?? '') as RecencyFilter
  const sort = (
    SORT_OPTIONS.some((o) => o.value === sp.sort) ? sp.sort : 'joined-desc'
  ) as SortValue

  const { rows, total, nowMs } = await loadMembers({
    q,
    page,
    showArchived,
    plan,
    onboarding,
    recency,
    sort,
  })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtersActive =
    Boolean(q) ||
    Boolean(plan) ||
    Boolean(onboarding) ||
    Boolean(recency) ||
    showArchived

  const baseParams = {
    q,
    showArchived,
    plan,
    onboarding,
    recency,
    sort,
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl mb-1">Members</h1>
          <p className="text-neutral-600">
            {total.toLocaleString()} {total === 1 ? 'member' : 'members'}
            {filtersActive ? ' match the current filters' : ''}
            {showArchived ? ' · including archived' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/admin/members/designations"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-neutral-200 text-neutral-700 rounded-md hover:border-neutral-400 hover:text-neutral-900"
          >
            Designations
          </Link>
          <Link
            href="/admin/members/new"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-darkBlue-900 text-white rounded-md hover:bg-darkBlue-800"
          >
            Add member
          </Link>
        </div>
      </div>

      <form
        action="/admin/members"
        method="get"
        className="bg-white border border-neutral-200 rounded-lg p-4 mb-6 space-y-3"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              Search
            </label>
            <Search
              size={16}
              className="absolute left-3 top-[34px] text-neutral-400"
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Name, email, or company"
              className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-md text-sm focus:outline-none focus:border-darkBlue-900"
            />
          </div>

          <FilterSelect
            label="Plan"
            name="plan"
            options={PLAN_OPTIONS}
            value={plan}
          />
          <FilterSelect
            label="Onboarding"
            name="onboarding"
            options={ONBOARDING_OPTIONS}
            value={onboarding}
          />
          <FilterSelect
            label="Last visit"
            name="recency"
            options={RECENCY_OPTIONS}
            value={recency}
          />
          <FilterSelect
            label="Sort"
            name="sort"
            options={SORT_OPTIONS}
            value={sort}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <label className="inline-flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              name="archived"
              value="1"
              defaultChecked={showArchived}
            />
            Show archived
          </label>
          <button
            type="submit"
            className="px-3 py-1.5 text-sm font-medium bg-neutral-900 text-white rounded-md hover:bg-neutral-700"
          >
            Apply
          </button>
          {filtersActive && (
            <Link
              href="/admin/members"
              className="text-sm text-neutral-500 hover:text-neutral-900 underline"
            >
              Clear all
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center text-neutral-500">
          {filtersActive
            ? 'No members match the current filters.'
            : 'No members yet.'}
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Plan / passes</th>
                  <th className="px-4 py-3">Last visit</th>
                  <th className="px-4 py-3">Last sign-in</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((m) => (
                  <tr
                    key={m.id}
                    className={cn(
                      'hover:bg-neutral-50 transition',
                      m.archived && 'opacity-60'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ListAvatar
                          url={m.selfieUrl}
                          name={m.fullName ?? m.email}
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/members/${m.id}`}
                            className="font-medium text-neutral-900 hover:text-darkBlue-900"
                          >
                            {m.fullName ?? '—'}
                          </Link>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {m.role === 'admin' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-darkBlue-900 text-white">
                                ADMIN
                              </span>
                            )}
                            {m.designation && (
                              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-lime-100 text-lime-900 uppercase">
                                {m.designation.replace(/_/g, ' ')}
                              </span>
                            )}
                            {m.archived && (
                              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-neutral-200 text-neutral-700">
                                ARCHIVED
                              </span>
                            )}
                            {!m.termsAcceptedAt && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-orange-100 text-orange-800">
                                <AlertCircle size={10} />
                                NOT ONBOARDED
                              </span>
                            )}
                            {m.company && (
                              <span className="text-[11px] text-neutral-500">
                                {m.company}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      {m.email}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {m.planName ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-turquoise-100 text-turquoise-800">
                          {m.planName}
                        </span>
                      ) : m.passUsesRemaining > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                          {m.passUsesRemaining} pass
                          {m.passUsesRemaining === 1 ? '' : 'es'}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {relTime(m.lastVisitAt, nowMs)}
                      {m.totalVisits > 0 && (
                        <span className="text-xs text-neutral-400 ml-1">
                          ({m.totalVisits})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {relTime(m.lastSignInAt, nowMs)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {fmtDate(m.registeredAt ?? m.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/members/${m.id}`}
                        className="text-neutral-400 hover:text-darkBlue-900"
                      >
                        <ArrowRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <span className="text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={`/admin/members?${nextSearchParams(baseParams, page - 1).toString()}`}
                className="px-3 py-1.5 border border-neutral-200 rounded-md hover:bg-neutral-50"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/members?${nextSearchParams(baseParams, page + 1).toString()}`}
                className="px-3 py-1.5 border border-neutral-200 rounded-md hover:bg-neutral-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FilterSelect({
  label,
  name,
  options,
  value,
}: {
  label: string
  name: string
  options: readonly { value: string; label: string }[]
  value: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="px-2 py-2 border border-neutral-200 rounded-md text-sm bg-white focus:outline-none focus:border-darkBlue-900"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ListAvatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={`${name} selfie`}
        width={36}
        height={36}
        className="w-9 h-9 rounded-full object-cover border border-neutral-200 shrink-0"
        unoptimized
      />
    )
  }
  return (
    <div className="w-9 h-9 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 shrink-0">
      <User size={16} strokeWidth={1.5} />
    </div>
  )
}
