import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getCreditBalanceCents } from '@/lib/credits/balance'
import { memberAccess } from '@/lib/gym/entitlement'
import { effectivePrice, fmtTtd } from '@/lib/pricing/effective'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Memberships & packs — Pinnacle Fitness',
  description:
    'Monthly plans, PT packs and open-gym packs. Monthly plans reset each month; packs are valid 30 days.',
}

interface Plan {
  id: string
  name: string
  description: string | null
  price_cents: number
  discounted_price_cents: number | null
  discount_expires_at: string | null
  features: string[]
  pt_sessions_per_month: number | null
  includes_open_gym: boolean
  open_gym_visits_per_month: number | null
  display_order: number
}

interface Pass {
  id: string
  name: string
  description: string | null
  price_cents: number
  discounted_price_cents: number | null
  discount_expires_at: string | null
  uses_total: number
  validity_days: number
  session_kind: 'pt' | 'open_gym'
}

async function loadCatalog(): Promise<{ plans: Plan[]; passes: Pass[] }> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const [{ data: plans }, { data: passes }] = await Promise.all([
    supabase
      .from('plans')
      .select(
        'id, name, description, price_cents, discounted_price_cents, discount_expires_at, features, pt_sessions_per_month, includes_open_gym, open_gym_visits_per_month, display_order'
      )
      .eq('is_active', true)
      .eq('is_private', false)
      .order('display_order', { ascending: true }),
    supabase
      .from('passes')
      .select(
        'id, name, description, price_cents, discounted_price_cents, discount_expires_at, uses_total, validity_days, session_kind'
      )
      .eq('is_active', true)
      .eq('is_private', false)
      .order('display_order', { ascending: true }),
  ])
  return {
    plans: ((plans as Record<string, unknown>[] | null) ?? []).map((r) => ({
      ...(r as unknown as Plan),
      features: Array.isArray(r.features) ? (r.features as string[]) : [],
    })),
    passes: ((passes as Record<string, unknown>[] | null) ?? []).map(
      (r) => ({
        ...(r as unknown as Pass),
        session_kind: (r.session_kind as 'pt' | 'open_gym') ?? 'pt',
      })
    ),
  }
}

function perSession(cents: number, count: number | null): string | null {
  if (!count || count <= 0) return null
  return `${fmtTtd(Math.round(cents / count))} per session`
}

export default async function BuyPage() {
  const [{ plans, passes }, user] = await Promise.all([
    loadCatalog(),
    getCurrentUser(),
  ])
  const admin = createAdminClient()
  const [creditCents, access] = user
    ? await Promise.all([
        getCreditBalanceCents(admin, user.id),
        memberAccess(admin, user.id),
      ])
    : [0, null]

  const ptPacks = passes.filter((p) => p.session_kind === 'pt')
  const ogPacks = passes.filter((p) => p.session_kind === 'open_gym')
  const memberships = plans.filter(
    (p) => p.pt_sessions_per_month === null || p.pt_sessions_per_month > 0
  )
  const openGymPlans = plans.filter((p) => p.pt_sessions_per_month === 0)

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <p className="text-[11px] tracking-[0.18em] uppercase text-turf mb-2">
        Memberships &amp; packs
      </p>
      <h1 className="heading-display text-4xl sm:text-5xl mb-3">
        Pick how
        <br />
        you train.
      </h1>
      <p className="text-ice-dim mb-8 max-w-md">
        Monthly plans are the cheapest way to train and reset every month.
        Packs buy flexibility — valid 30 days from purchase.
      </p>

      {creditCents > 0 && (
        <p className="mb-6 rounded-full bg-turf/10 border border-turf/30 px-4 py-2 text-sm text-turf">
          You have {fmtTtd(creditCents)} account credit — it applies at
          checkout automatically.
        </p>
      )}
      {access?.plan && (
        <p className="mb-6 text-sm text-ice-mute">
          You&apos;re on <span className="text-ice">{access.plan.name}</span>.
          Packs top up on top of your plan; to switch plans, ask a coach.
        </p>
      )}

      <Section title="Memberships" note="Per month · resets on your renewal date">
        {memberships.map((plan) => {
          const priced = effectivePrice(plan)
          const per = perSession(priced.effectiveCents, plan.pt_sessions_per_month)
          const highlight = plan.id === 'pt-12'
          return (
            <Card
              key={plan.id}
              href={`/subscribe/${plan.id}`}
              highlight={highlight}
              name={plan.name}
              price={fmtTtd(priced.effectiveCents)}
              strike={priced.isDiscountActive ? fmtTtd(priced.regularCents) : null}
              meta={[
                plan.pt_sessions_per_month === null
                  ? 'Unlimited PT sessions'
                  : `${plan.pt_sessions_per_month} PT sessions / month`,
                plan.includes_open_gym ? 'Open gym included' : 'Open gym as add-on',
                per,
              ]}
              cta={access?.plan?.id === plan.id ? 'Your plan' : 'Choose'}
              badge={highlight ? 'Most popular' : null}
              disabled={Boolean(access?.plan) && access?.plan?.id !== plan.id}
            />
          )
        })}
      </Section>

      <Section title="PT packs" note="Coached sessions with Nasyir or Matthew · valid 30 days">
        {ptPacks.map((pass) => {
          const priced = effectivePrice(pass)
          return (
            <Card
              key={pass.id}
              href={`/buy/${pass.id}`}
              name={pass.name}
              price={fmtTtd(priced.effectiveCents)}
              strike={priced.isDiscountActive ? fmtTtd(priced.regularCents) : null}
              meta={[
                `${pass.uses_total} session${pass.uses_total === 1 ? '' : 's'}`,
                perSession(priced.effectiveCents, pass.uses_total),
                `Valid ${pass.validity_days} days`,
              ]}
              cta="Buy"
            />
          )
        })}
      </Section>

      <Section title="Open gym" note="Scan in whenever the floor has room · 20-person cap">
        {openGymPlans.map((plan) => {
          const priced = effectivePrice(plan)
          return (
            <Card
              key={plan.id}
              href={`/subscribe/${plan.id}`}
              name={plan.name}
              price={fmtTtd(priced.effectiveCents)}
              strike={priced.isDiscountActive ? fmtTtd(priced.regularCents) : null}
              meta={['Unlimited open gym', 'Per month']}
              cta={access?.plan?.id === plan.id ? 'Your plan' : 'Choose'}
              disabled={Boolean(access?.plan) && access?.plan?.id !== plan.id}
            />
          )
        })}
        {ogPacks.map((pass) => {
          const priced = effectivePrice(pass)
          return (
            <Card
              key={pass.id}
              href={`/buy/${pass.id}`}
              name={pass.name}
              price={fmtTtd(priced.effectiveCents)}
              strike={priced.isDiscountActive ? fmtTtd(priced.regularCents) : null}
              meta={[
                `${pass.uses_total} visit${pass.uses_total === 1 ? '' : 's'}`,
                perSession(priced.effectiveCents, pass.uses_total)?.replace(
                  'session',
                  'visit'
                ) ?? null,
                `Valid ${pass.validity_days} days`,
              ]}
              cta="Buy"
            />
          )
        })}
      </Section>

      {!user && (
        <p className="text-sm text-ice-mute mt-4">
          Not a member yet?{' '}
          <Link href="/apply" className="text-turf underline">
            Apply to join
          </Link>{' '}
          — purchases open once you&apos;re approved.
        </p>
      )}
    </div>
  )
}

function Section({
  title,
  note,
  children,
}: {
  title: string
  note: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <h2 className="font-heading text-xl">{title}</h2>
      <p className="text-xs text-ice-mute mb-3">{note}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function Card({
  href,
  name,
  price,
  strike,
  meta,
  cta,
  badge,
  highlight = false,
  disabled = false,
}: {
  href: string
  name: string
  price: string
  strike: string | null
  meta: (string | null)[]
  cta: string
  badge?: string | null
  highlight?: boolean
  disabled?: boolean
}) {
  const inner = (
    <div
      className={
        highlight
          ? 'relative rounded-lg bg-ice text-ground p-5 flex items-center justify-between gap-4'
          : 'relative rounded-lg bg-card border border-border p-5 flex items-center justify-between gap-4'
      }
    >
      {badge && (
        <span className="absolute -top-2.5 left-5 rounded-full bg-primary text-primary-foreground text-[10px] font-heading tracking-[0.1em] uppercase px-3 py-1">
          {badge}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-heading text-lg">{name}</p>
        <p className={highlight ? 'text-xs opacity-70 mt-1' : 'text-xs text-ice-mute mt-1'}>
          {meta.filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={highlight ? 'font-stat text-2xl' : 'font-stat text-2xl text-turf'}>
          {price}
        </p>
        {strike && (
          <p className="text-xs line-through opacity-60">{strike}</p>
        )}
        <span
          className={
            highlight
              ? 'inline-block mt-1 text-xs font-heading underline underline-offset-4'
              : 'inline-block mt-1 text-xs font-heading text-ice-dim underline underline-offset-4'
          }
        >
          {cta}
        </span>
      </div>
    </div>
  )
  if (disabled) return <div className="opacity-50">{inner}</div>
  return <Link href={href}>{inner}</Link>
}
