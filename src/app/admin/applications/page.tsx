import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'
import { effectivePrice } from '@/lib/pricing/effective'
import ApplicationCard, {
  type ApplicationView,
  type PlanOption,
} from '@/components/applications/application-card'
import WaitlistInvite from '@/components/applications/waitlist-invite'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Applications — Pinnacle' }

const TABS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'new', label: 'New', statuses: ['new', 'intro_booked'] },
  { key: 'waitlist', label: 'Waitlist', statuses: ['waitlisted'] },
  { key: 'invited', label: 'Invited', statuses: ['invited'] },
  { key: 'approved', label: 'Approved', statuses: ['approved'] },
  { key: 'closed', label: 'Closed', statuses: ['declined', 'screened_out'] },
]

async function load(tab: string) {
  const admin = createAdminClient()
  const [{ data: rows }, { data: planRows }, { data: counts }] =
    await Promise.all([
      admin
        .from('applications')
        .select(
          'id, full_name, email, phone, experience_bracket, training_now, goal, heard_from, referred_by, plan_interest, status, coach_notes, created_at, invited_at, invite_expires_at, invite_payment_id'
        )
        .order('created_at', { ascending: true })
        .limit(500),
      admin
        .from('plans')
        .select(
          'id, name, price_cents, discounted_price_cents, discount_expires_at, is_active, is_private'
        )
        .eq('is_active', true)
        .eq('is_private', false)
        .order('display_order'),
      admin.from('applications').select('status'),
    ])

  const all = (rows as Record<string, unknown>[] | null) ?? []
  const paymentIds = all
    .map((r) => r.invite_payment_id as string | null)
    .filter((id): id is string => Boolean(id))
  const paidIds = new Set<string>()
  if (paymentIds.length > 0) {
    const { data: pays } = await admin
      .from('payments')
      .select('id')
      .in('id', paymentIds)
      .eq('status', 'succeeded')
    for (const p of (pays as { id: string }[] | null) ?? []) paidIds.add(p.id)
  }

  const statuses = TABS.find((t) => t.key === tab)?.statuses ?? TABS[0].statuses
  const apps: ApplicationView[] = all
    .filter((r) => statuses.includes(r.status as string))
    .map((r) => ({
      id: r.id as string,
      fullName: r.full_name as string,
      email: r.email as string,
      phone: (r.phone as string | null) ?? null,
      experienceBracket: (r.experience_bracket as string | null) ?? null,
      trainingNow: (r.training_now as string | null) ?? null,
      goal: (r.goal as string | null) ?? null,
      heardFrom: (r.heard_from as string | null) ?? null,
      referredBy: (r.referred_by as string | null) ?? null,
      planInterest: (r.plan_interest as string | null) ?? null,
      status: r.status as string,
      coachNotes: (r.coach_notes as string | null) ?? null,
      createdAt: r.created_at as string,
      invitedAt: (r.invited_at as string | null) ?? null,
      inviteExpiresAt: (r.invite_expires_at as string | null) ?? null,
      paid: paidIds.has((r.invite_payment_id as string | null) ?? ''),
    }))

  const plans: PlanOption[] = (
    (planRows as Record<string, unknown>[] | null) ?? []
  ).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    priceCents: effectivePrice({
      price_cents: p.price_cents as number,
      discounted_price_cents:
        (p.discounted_price_cents as number | null) ?? null,
      discount_expires_at: (p.discount_expires_at as string | null) ?? null,
    }).effectiveCents,
  }))

  const countByStatus = new Map<string, number>()
  for (const c of (counts as { status: string }[] | null) ?? []) {
    countByStatus.set(c.status, (countByStatus.get(c.status) ?? 0) + 1)
  }
  const tabCounts = TABS.map((t) => ({
    ...t,
    count: t.statuses.reduce((s, st) => s + (countByStatus.get(st) ?? 0), 0),
  }))

  return { apps, plans, tabCounts }
}

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'new' } = await searchParams
  const { apps, plans, tabCounts } = await load(tab)
  const waiting = tabCounts.find((t) => t.key === 'waitlist')?.count ?? 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Applications</h1>
        <p className="text-muted-foreground max-w-2xl">
          Everyone who wants in. Beginners are screened out automatically;
          everyone else lands here for a coach to read, meet, and decide.
          Approving sends the welcome email with a 7-day pay link — the
          membership goes live when the money confirms.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabCounts.map((t) => (
          <Link
            key={t.key}
            href={`/admin/applications?tab=${t.key}`}
            className={
              tab === t.key
                ? 'inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold'
                : 'inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm font-semibold text-muted-foreground hover:text-foreground'
            }
          >
            {t.label}
            <span className="font-stat text-base">{t.count}</span>
          </Link>
        ))}
      </div>

      {tab === 'waitlist' && (
        <div className="mb-6">
          <WaitlistInvite waiting={waiting} />
        </div>
      )}

      {apps.length === 0 ? (
        <div className="rounded-card bg-card border border-border p-10 text-center text-muted-foreground text-sm">
          Nothing here right now.
        </div>
      ) : (
        <ul className="space-y-4">
          {apps.map((a) => (
            <ApplicationCard key={a.id} app={a} plans={plans} />
          ))}
        </ul>
      )}
    </div>
  )
}
