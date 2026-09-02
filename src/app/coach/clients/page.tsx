import Link from 'next/link'
import { requireCoach } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/utils/supabase/admin'
import { sessionBalance } from '@/lib/sessions/ledger'
import { fmtAstDate } from '@/lib/time/ast'

export const metadata = { title: 'My clients — Coach' }

interface ClientRow {
  id: string
  name: string
  email: string
  planName: string | null
  ptLeft: number
  lastVisit: string | null
  notes: string | null
  goal: string | null
}

export default async function CoachClientsPage() {
  const coach = await requireCoach()
  const admin = createAdminClient()
  const { data: coachRow } = await admin.from('coaches').select('slug').eq('id', coach.coachId).maybeSingle()
  const resourceId = `pt-${(coachRow as { slug: string } | null)?.slug ?? ''}`

  // Anyone who booked me recently, or who picked me as their coach.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const [{ data: recent }, { data: preferred }] = await Promise.all([
    admin
      .from('bookings')
      .select('user_id')
      .eq('resource_id', resourceId)
      .in('status', ['confirmed', 'completed', 'no_show'])
      .gte('during', `[${since},)`)
      .limit(2000),
    admin.from('profiles').select('id').eq('preferred_coach_id', coach.coachId).eq('archived', false),
  ])
  const ids = new Set<string>()
  for (const r of (recent as { user_id: string | null }[] | null) ?? []) if (r.user_id) ids.add(r.user_id)
  for (const r of (preferred as { id: string }[] | null) ?? []) ids.add(r.id)

  let clients: ClientRow[] = []
  if (ids.size > 0) {
    const idList = [...ids]
    const [{ data: profiles }, { data: subs }, { data: visits }] = await Promise.all([
      admin.from('profiles').select('id, full_name, email, training_notes, goal').in('id', idList).eq('archived', false),
      admin
        .from('subscriptions')
        .select('user_id, plans(name)')
        .in('user_id', idList)
        .in('status', ['active', 'past_due']),
      admin
        .from('visits')
        .select('user_id, checked_in_at')
        .in('user_id', idList)
        .order('checked_in_at', { ascending: false })
        .limit(500),
    ])
    const planBy = new Map<string, string>()
    for (const s of (subs as { user_id: string; plans: { name?: string } | { name?: string }[] | null }[] | null) ?? []) {
      const p = Array.isArray(s.plans) ? (s.plans[0] ?? null) : s.plans
      if (p?.name) planBy.set(s.user_id, p.name)
    }
    const lastBy = new Map<string, string>()
    for (const v of (visits as { user_id: string; checked_in_at: string }[] | null) ?? []) {
      if (!lastBy.has(v.user_id)) lastBy.set(v.user_id, v.checked_in_at)
    }
    clients = await Promise.all(
      ((profiles as { id: string; full_name: string | null; email: string; training_notes: string | null; goal: string | null }[] | null) ?? []).map(
        async (p) => ({
          id: p.id,
          name: p.full_name?.trim() || p.email,
          email: p.email,
          planName: planBy.get(p.id) ?? null,
          ptLeft: await sessionBalance(admin, p.id, 'pt'),
          lastVisit: lastBy.get(p.id) ?? null,
          notes: p.training_notes,
          goal: p.goal,
        })
      )
    )
    clients.sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''))
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">My clients</h1>
        <p className="text-neutral-600">Everyone who&apos;s trained with you in the last 90 days or picked you as their coach.</p>
      </div>
      {clients.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-10 text-center text-neutral-500 text-sm">No clients yet.</div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((c) => (
            <li key={c.id} className="bg-white border border-neutral-200 rounded-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/members/${c.id}`} className="font-medium hover:underline truncate block">
                    {c.name}
                  </Link>
                  <p className="text-xs text-neutral-500">
                    {c.planName ?? 'No plan'} · last in {c.lastVisit ? fmtAstDate(c.lastVisit) : 'never'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-stat text-2xl text-turquoise-700">{c.ptLeft}</p>
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500">PT left</p>
                </div>
              </div>
              {(c.goal || c.notes) && (
                <p className="text-sm text-neutral-600 mt-3">
                  {c.goal && <span className="font-medium">{c.goal}. </span>}
                  {c.notes}
                </p>
              )}
              <Link
                href={`/admin/notifications?to=${encodeURIComponent(c.email)}`}
                className="inline-flex mt-3 px-3 py-1.5 text-xs font-semibold rounded-full border border-neutral-300 hover:border-turquoise-500"
              >
                Message
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
