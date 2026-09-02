import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { effectivePrice, fmtTtd } from '@/lib/pricing/effective'
import {
  Section,
  Eyebrow,
  Display,
  Pill,
} from '@/components/marketing/primitives'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Memberships — Pinnacle Fitness',
  description:
    'Monthly coached memberships from TT$700, PT packs of 5, 10 and 20 sessions, and open gym access at Pinnacle Fitness, Port of Spain. Membership by application.',
}

interface CatalogItem {
  id: string
  kind: 'plan' | 'pass'
  name: string
  description: string
  priceCents: number
  regularCents: number
  discountActive: boolean
  perSessionCents: number | null
  perSessionLabel: string | null
  features: string[]
  highlight: boolean
  group: 'membership' | 'pt-pack' | 'open-gym'
  order: number
}

const PLAN_BLURBS: Record<string, string> = {
  'pt-8':
    'Eight coached sessions a month gives you the structure to stop guessing and start progressing. A coach who knows your name, your goals, and builds every session around getting you there.',
  'pt-12':
    'Three sessions a week, coached, consistent, and progressive. This is the plan where most people see their biggest shift. You stop waiting to feel motivated and just show up, because your coach and your community expect you to.',
  unlimited:
    'For the fully committed. Unlimited coached sessions, open gym access, and priority booking. Your only job is to show up.',
  'open-gym-unlimited':
    'Self-directed. The floor, the machines, the turf, whenever we are open — scan in, do the work.',
}

function planPerSession(row: Record<string, unknown>, cents: number) {
  const n = row.pt_sessions_per_month as number | null
  if (n && n > 0) {
    return {
      cents: Math.round(cents / n),
      label: `per session · ${n} a month`,
    }
  }
  return null
}

async function loadCatalog(): Promise<CatalogItem[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const [{ data: plans }, { data: passes }] = await Promise.all([
    supabase
      .from('plans')
      .select(
        'id, name, description, price_cents, discounted_price_cents, discount_expires_at, features, display_order, pt_sessions_per_month, includes_open_gym'
      )
      .eq('is_active', true)
      .eq('is_private', false)
      .order('display_order', { ascending: true }),
    supabase
      .from('passes')
      .select(
        'id, name, description, price_cents, discounted_price_cents, discount_expires_at, uses_total, validity_days, features, display_order, session_kind'
      )
      .eq('is_active', true)
      .eq('is_private', false)
      .order('display_order', { ascending: true }),
  ])

  const items: CatalogItem[] = []
  for (const raw of (plans as Record<string, unknown>[] | null) ?? []) {
    const p = effectivePrice({
      price_cents: raw.price_cents as number,
      discounted_price_cents: (raw.discounted_price_cents as number) ?? null,
      discount_expires_at: (raw.discount_expires_at as string) ?? null,
    })
    const per = planPerSession(raw, p.effectiveCents)
    const isOpenGym = !raw.pt_sessions_per_month && raw.includes_open_gym
    items.push({
      id: raw.id as string,
      kind: 'plan',
      name: raw.name as string,
      description:
        ((raw.description as string | null) ?? '').trim() ||
        PLAN_BLURBS[raw.id as string] ||
        '',
      priceCents: p.effectiveCents,
      regularCents: p.regularCents,
      discountActive: p.isDiscountActive,
      perSessionCents: per?.cents ?? null,
      perSessionLabel: per?.label ?? null,
      features: Array.isArray(raw.features) ? (raw.features as string[]) : [],
      highlight: raw.id === 'pt-12',
      group: isOpenGym ? 'open-gym' : 'membership',
      order: (raw.display_order as number) ?? 0,
    })
  }
  for (const raw of (passes as Record<string, unknown>[] | null) ?? []) {
    const p = effectivePrice({
      price_cents: raw.price_cents as number,
      discounted_price_cents: (raw.discounted_price_cents as number) ?? null,
      discount_expires_at: (raw.discount_expires_at as string) ?? null,
    })
    const uses = (raw.uses_total as number) ?? 1
    const isOpenGym = raw.session_kind === 'open_gym'
    items.push({
      id: raw.id as string,
      kind: 'pass',
      name: raw.name as string,
      description: ((raw.description as string | null) ?? '').trim(),
      priceCents: p.effectiveCents,
      regularCents: p.regularCents,
      discountActive: p.isDiscountActive,
      perSessionCents: uses > 1 ? Math.round(p.effectiveCents / uses) : null,
      perSessionLabel:
        uses > 1
          ? `per ${isOpenGym ? 'visit' : 'session'} · ${uses} pack`
          : null,
      features: Array.isArray(raw.features) ? (raw.features as string[]) : [],
      highlight: false,
      group: isOpenGym ? 'open-gym' : 'pt-pack',
      order: (raw.display_order as number) ?? 0,
    })
  }
  return items
}

function Card({
  item,
  signedIn,
}: {
  item: CatalogItem
  signedIn: boolean
}) {
  const href = signedIn
    ? item.kind === 'plan'
      ? `/subscribe/${item.id}`
      : `/buy/${item.id}`
    : `/apply?plan=${encodeURIComponent(item.id)}`
  const suffix =
    item.kind === 'plan'
      ? '/ month'
      : item.group === 'open-gym'
        ? item.perSessionCents
          ? ''
          : '/ visit'
        : item.perSessionCents
          ? ''
          : '/ session'
  return (
    <div
      className={
        item.highlight
          ? 'relative bg-primary text-primary-foreground rounded-[22px] p-7 flex flex-col gap-5'
          : 'bg-card border border-border rounded-[22px] p-7 flex flex-col gap-5'
      }
    >
      {item.highlight && (
        <span className="absolute -top-3 left-6 rounded-full bg-background text-foreground text-[11px] font-semibold tracking-[0.14em] uppercase px-3 py-1">
          Most popular
        </span>
      )}
      <Display as="h3" className="text-2xl">
        {item.name}
      </Display>
      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-stat text-4xl leading-none">
            {fmtTtd(item.priceCents)}
          </span>
          <span
            className={
              item.highlight
                ? 'text-sm text-primary-foreground/70'
                : 'text-sm text-muted-foreground'
            }
          >
            {suffix}
          </span>
          {item.discountActive && (
            <span className="text-sm line-through opacity-60">
              {fmtTtd(item.regularCents)}
            </span>
          )}
        </div>
        {item.perSessionCents && (
          <p
            className={
              item.highlight
                ? 'mt-1 text-xs text-primary-foreground/70'
                : 'mt-1 text-xs text-muted-foreground'
            }
          >
            {fmtTtd(item.perSessionCents)} {item.perSessionLabel}
          </p>
        )}
      </div>
      {item.description && (
        <p
          className={
            item.highlight
              ? 'text-sm leading-relaxed text-primary-foreground/85 flex-1'
              : 'text-sm leading-relaxed text-muted-foreground flex-1'
          }
        >
          {item.description}
        </p>
      )}
      {item.features.length > 0 && (
        <ul className="text-sm space-y-1.5">
          {item.features.map((f) => (
            <li key={f} className="flex gap-2">
              <span aria-hidden="true">—</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
      <Pill
        href={href}
        variant={item.highlight ? 'outline' : 'primary'}
        className={
          item.highlight
            ? 'mt-auto border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary'
            : 'mt-auto'
        }
      >
        {signedIn ? 'Choose' : 'Apply to join'}
      </Pill>
    </div>
  )
}

function Group({
  eyebrow,
  title,
  blurb,
  items,
  signedIn,
  columns = 3,
}: {
  eyebrow: string
  title: string
  blurb: string
  items: CatalogItem[]
  signedIn: boolean
  columns?: 2 | 3 | 4
}) {
  if (items.length === 0) return null
  return (
    <Section className="pt-6 pb-10">
      <div className="mb-8 max-w-2xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <Display>{title}</Display>
        <p className="mt-4 text-muted-foreground leading-relaxed">{blurb}</p>
      </div>
      <div
        className={
          columns === 4
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5'
            : columns === 2
              ? 'grid grid-cols-1 md:grid-cols-2 gap-5'
              : 'grid grid-cols-1 md:grid-cols-3 gap-5'
        }
      >
        {items.map((it) => (
          <Card key={`${it.kind}-${it.id}`} item={it} signedIn={signedIn} />
        ))}
      </div>
    </Section>
  )
}

export default async function PricingPage() {
  const [items, user] = await Promise.all([loadCatalog(), getCurrentUser()])
  const signedIn = !!user
  const memberships = items
    .filter((i) => i.group === 'membership')
    .sort((a, b) => a.order - b.order)
  const ptPacks = items
    .filter((i) => i.group === 'pt-pack')
    .sort((a, b) => a.order - b.order)
  const openGym = items
    .filter((i) => i.group === 'open-gym')
    .sort((a, b) => a.order - b.order)

  return (
    <>
      <Section className="pb-6">
        <Eyebrow>Memberships</Eyebrow>
        <Display as="h1">Pick your plan.</Display>
        <p className="mt-8 max-w-xl text-lg text-muted-foreground leading-relaxed">
          Built for every kind of athlete — whether you train twice a week or
          every single day. Monthly plans reset each month. Packs are valid 30
          days.
        </p>
        {!signedIn && (
          <p className="mt-4 text-sm text-muted-foreground">
            Membership is by application. Pick the plan you want, apply, and
            you pay only once a coach has approved you.
          </p>
        )}
      </Section>

      <Group
        eyebrow="Monthly"
        title="Coached memberships."
        blurb="Small-group PT with Nasyir or Matthew, a set number of sessions a month, and the community that comes with it."
        items={memberships}
        signedIn={signedIn}
      />
      <Group
        eyebrow="PT packs"
        title="Pay by the session."
        blurb="For members who train in bursts. Buy a pack, book with either coach, and use it within 30 days."
        items={ptPacks}
        signedIn={signedIn}
        columns={4}
      />
      <Group
        eyebrow="Open gym"
        title="The floor, on your terms."
        blurb="Scan in whenever we are open. The floor takes 20 people at a time, and the app shows you how many are on it before you leave home."
        items={openGym}
        signedIn={signedIn}
        columns={openGym.length >= 4 ? 4 : 3}
      />

      {items.length === 0 && (
        <Section>
          <p className="text-muted-foreground">
            Memberships are being set up. Check back shortly, or{' '}
            <a href="/contact" className="text-primary underline">
              get in touch
            </a>
            .
          </p>
        </Section>
      )}

      <Section className="bg-card">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <Display>Not sure which?</Display>
            <p className="mt-4 max-w-lg text-muted-foreground text-lg">
              Apply, come to an intro session, and the coaches will tell you
              honestly what fits.
            </p>
          </div>
          <Pill href="/apply" className="shrink-0">
            Apply to join
          </Pill>
        </div>
      </Section>
    </>
  )
}
