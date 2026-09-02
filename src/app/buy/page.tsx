import Link from 'next/link'
import { cookies } from 'next/headers'
import { ArrowRight, Calendar, ChevronRight } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  effectivePrice,
  fmtSavings,
  fmtPromoEndShort,
} from '@/lib/pricing/effective'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Buy a pass, plan, or room — The Worx',
  description:
    'Buy a day pass, subscribe to a monthly plan, or book a meeting room at The Worx coworking space in Port of Spain.',
}

interface Pass {
  id: string
  name: string
  description: string | null
  price_cents: number
  discounted_price_cents: number | null
  discount_expires_at: string | null
  currency: string
  uses_total: number
  features: string[]
}

interface Plan {
  id: string
  name: string
  description: string | null
  price_cents: number
  discounted_price_cents: number | null
  discount_expires_at: string | null
  currency: string
  billing_period: string
}

interface Resource {
  id: string
  name: string
  description: string | null
  kind: string
  capacity: number
  price_per_hour_cents: number | null
  currency: string
  is_bookable: boolean
  requires_contact: boolean
}

function fmtTtd(cents: number, currency = 'TTD'): string {
  return `${currency} $${(cents / 100).toFixed(0)}`
}

interface PriceLabels {
  final: string
  original?: string
  savings?: string
  promoEnds?: string
}

function passPrice(pass: Pass): PriceLabels {
  const p = effectivePrice(pass)
  if (p.isDiscountActive) {
    return {
      final: fmtTtd(p.effectiveCents, pass.currency),
      original: fmtTtd(p.regularCents, pass.currency),
      savings: fmtSavings(p) ?? undefined,
      promoEnds: fmtPromoEndShort(p.expiresAt) ?? undefined,
    }
  }
  return { final: fmtTtd(p.effectiveCents, pass.currency) }
}

function planPrice(plan: Plan): PriceLabels {
  const p = effectivePrice(plan)
  if (p.isDiscountActive) {
    return {
      final: fmtTtd(p.effectiveCents, plan.currency),
      original: fmtTtd(p.regularCents, plan.currency),
      savings: fmtSavings(p) ?? undefined,
      promoEnds: fmtPromoEndShort(p.expiresAt) ?? undefined,
    }
  }
  return { final: fmtTtd(p.effectiveCents, plan.currency) }
}

async function loadCatalog(): Promise<{
  passes: Pass[]
  plans: Plan[]
  resources: Resource[]
}> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const [{ data: passesData }, { data: plansData }, { data: resourcesData }] =
    await Promise.all([
      supabase
        .from('passes')
        .select(
          'id, name, description, price_cents, discounted_price_cents, discount_expires_at, currency, uses_total, features'
        )
        .eq('is_active', true)
        .eq('is_private', false)
        .order('display_order', { ascending: true }),
      supabase
        .from('plans')
        .select(
          'id, name, description, price_cents, discounted_price_cents, discount_expires_at, currency, billing_period'
        )
        .eq('is_active', true)
        .eq('is_private', false)
        .order('display_order', { ascending: true }),
      supabase
        .from('resources')
        .select(
          'id, name, description, kind, capacity, price_per_hour_cents, currency, is_bookable, requires_contact, admin_only'
        )
        .neq('admin_only', true)
        .order('display_order', { ascending: true }),
    ])

  return {
    passes: ((passesData as Record<string, unknown>[] | null) ?? []).map(
      (row) => ({
        id: row.id as string,
        name: row.name as string,
        description: (row.description as string | null) ?? null,
        price_cents: row.price_cents as number,
        discounted_price_cents:
          (row.discounted_price_cents as number | null) ?? null,
        discount_expires_at: (row.discount_expires_at as string | null) ?? null,
        currency: row.currency as string,
        uses_total: row.uses_total as number,
        features: Array.isArray(row.features) ? (row.features as string[]) : [],
      })
    ),
    plans: ((plansData as Record<string, unknown>[] | null) ?? []).map(
      (row) => ({
        id: row.id as string,
        name: row.name as string,
        description: (row.description as string | null) ?? null,
        price_cents: row.price_cents as number,
        discounted_price_cents:
          (row.discounted_price_cents as number | null) ?? null,
        discount_expires_at: (row.discount_expires_at as string | null) ?? null,
        currency: row.currency as string,
        billing_period: row.billing_period as string,
      })
    ),
    resources: ((resourcesData as Record<string, unknown>[] | null) ?? []).map(
      (row) => ({
        id: row.id as string,
        name: row.name as string,
        description: (row.description as string | null) ?? null,
        kind: row.kind as string,
        capacity: row.capacity as number,
        price_per_hour_cents:
          (row.price_per_hour_cents as number | null) ?? null,
        currency: row.currency as string,
        is_bookable: (row.is_bookable as boolean) ?? false,
        requires_contact: (row.requires_contact as boolean) ?? false,
      })
    ),
  }
}

const SELF_SERVE_PLAN_IDS = new Set([
  'hot-desk-monthly',
  'dedicated-desk-monthly',
])

function planCta(
  planId: string,
  isSignedIn: boolean
): {
  href: string
  label: string
  external?: boolean
} {
  if (
    planId === 'private-office-monthly' ||
    planId === 'corner-office-monthly'
  ) {
    return { href: 'tel:+18682810830', label: 'Call', external: true }
  }
  if (planId === 'virtual-office-monthly') {
    return { href: '/virtual-office', label: 'Get started' }
  }
  if (SELF_SERVE_PLAN_IDS.has(planId)) {
    return {
      href: isSignedIn
        ? `/subscribe/${planId}`
        : `/sign-up?next=${encodeURIComponent(`/subscribe/${planId}`)}`,
      label: 'Subscribe',
    }
  }
  return {
    href: 'mailto:team@theworx.io?subject=Plan%20inquiry',
    label: 'Email',
    external: true,
  }
}

export default async function BuyIndexPage() {
  const [{ passes, plans, resources }, currentUser] = await Promise.all([
    loadCatalog(),
    getCurrentUser(),
  ])
  const isSignedIn = currentUser !== null

  const bookableRooms = resources.filter(
    (r) => r.is_bookable && !r.requires_contact
  )
  const hasEventVenues = resources.some((r) => r.requires_contact)

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
      <div className="mb-10">
        <p className="text-sm font-medium text-turquoise-700 uppercase tracking-wide mb-2">
          Buy
        </p>
        <h1 className="font-heading text-4xl md:text-5xl mb-3">
          Pick what you need.
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl">
          A drop-in day, a monthly plan, or a room by the hour. Everything The
          Worx sells, in one place.
        </p>
      </div>

      {/* ============ Day passes ============ */}
      {passes.length > 0 && (
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-heading text-2xl">Day passes</h2>
            <p className="text-xs text-neutral-500">No subscription</p>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {passes.map((pass) => {
              const price = passPrice(pass)
              const isFeatured = pass.id === 'day-pass'
              return (
                <li key={pass.id}>
                  <Link
                    href={`/buy/${pass.id}`}
                    className={`group flex flex-col h-full bg-white rounded-lg p-6 border-2 transition hover:shadow-sm ${
                      isFeatured
                        ? 'border-turquoise-500'
                        : 'border-neutral-200 hover:border-turquoise-400'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-heading text-xl">{pass.name}</h3>
                      <ArrowRight
                        size={18}
                        className="text-neutral-400 group-hover:text-turquoise-600 group-hover:translate-x-0.5 transition mt-1 shrink-0"
                      />
                    </div>

                    <div className="mb-4">
                      <p className="font-heading text-3xl text-neutral-900">
                        {price.final}
                      </p>
                      {price.original && (
                        <p className="text-sm text-neutral-400 line-through">
                          {price.original}
                        </p>
                      )}
                      {price.savings && price.promoEnds && (
                        <p className="text-xs text-turquoise-700 font-medium mt-1">
                          {price.savings} · ends {price.promoEnds}
                        </p>
                      )}
                      <p className="text-xs text-neutral-500 mt-1">
                        {pass.uses_total === 1
                          ? '1 day'
                          : `${pass.uses_total} day-uses`}
                      </p>
                    </div>

                    {pass.description && (
                      <p className="text-sm text-neutral-600 mb-4">
                        {pass.description}
                      </p>
                    )}

                    <ul className="space-y-1 text-sm text-neutral-700 mt-auto">
                      {pass.features.slice(0, 4).map((f, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-turquoise-500 shrink-0">•</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ============ Monthly plans ============ */}
      {plans.length > 0 && (
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-heading text-2xl">Monthly memberships</h2>
            <p className="text-xs text-neutral-500">Cancel any time</p>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan) => {
              const cta = planCta(plan.id, isSignedIn)
              const priced = planPrice(plan)
              return (
                <li key={plan.id}>
                  <PlanRow
                    name={plan.name}
                    price={priced.final}
                    originalPrice={priced.original}
                    savings={priced.savings}
                    promoEnds={priced.promoEnds}
                    period={`per ${plan.billing_period}`}
                    description={plan.description ?? ''}
                    cta={cta}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ============ Rooms by the hour ============ */}
      {bookableRooms.length > 0 && (
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-heading text-2xl">Rooms by the hour</h2>
            <p className="text-xs text-neutral-500">30-minute slots</p>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bookableRooms.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/book/${room.id}`}
                  className="group flex flex-col h-full bg-white border-2 border-neutral-200 hover:border-turquoise-400 rounded-lg p-6 transition hover:shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-heading text-lg">{room.name}</h3>
                    <ArrowRight
                      size={16}
                      className="text-neutral-400 group-hover:text-turquoise-600 group-hover:translate-x-0.5 transition mt-1 shrink-0"
                    />
                  </div>
                  <div className="mb-3">
                    <p className="font-heading text-2xl text-neutral-900">
                      {room.price_per_hour_cents
                        ? fmtTtd(room.price_per_hour_cents, room.currency)
                        : '—'}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      per hour · seats {room.capacity}
                    </p>
                  </div>
                  {room.description && (
                    <p className="text-sm text-neutral-600 mt-auto">
                      {room.description}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ============ Events (co-branded, inquiry) ============ */}
      {hasEventVenues && (
        <section className="mb-12">
          <Link
            href="/spaces#events"
            className="group flex items-center justify-between gap-4 bg-neutral-900 text-white rounded-lg p-6 hover:bg-neutral-800 transition"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                <Calendar size={22} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-300 mb-1">
                  Events
                </p>
                <p className="font-heading text-xl mb-1">
                  Let&apos;s host something together
                </p>
                <p className="text-sm text-neutral-300">
                  Co-branded events on the coworking floor after 5pm or on the
                  rooftop. Call for pricing &mdash; we work with you on the
                  details.
                </p>
              </div>
            </div>
            <ChevronRight
              size={20}
              className="text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition shrink-0"
            />
          </Link>
        </section>
      )}

      <div className="pt-8 border-t border-neutral-200">
        <p className="text-sm text-neutral-600">
          Want the full tour with photos, inventory, and what&apos;s included?{' '}
          <Link
            href="/spaces"
            className="text-turquoise-700 underline font-medium"
          >
            See pricing &amp; spaces
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

interface PlanRowProps {
  name: string
  price: string
  originalPrice?: string
  savings?: string
  promoEnds?: string
  period: string
  description: string
  cta: { href: string; label: string; external?: boolean }
}

function PlanRow({
  name,
  price,
  originalPrice,
  savings,
  promoEnds,
  period,
  description,
  cta,
}: PlanRowProps) {
  const content = (
    <div className="flex items-center gap-4 bg-white border-2 border-neutral-200 hover:border-turquoise-400 rounded-lg p-5 md:p-6 transition hover:shadow-sm h-full">
      <div className="flex-1 min-w-0">
        <h3 className="font-heading text-lg mb-1">{name}</h3>
        <p className="text-sm text-neutral-600 mb-2 line-clamp-2">
          {description}
        </p>
        <p className="font-heading text-xl text-neutral-900">
          {price}
          <span className="text-sm font-sans font-normal text-neutral-500 ml-2">
            {period}
          </span>
        </p>
        {originalPrice && (
          <p className="text-sm text-neutral-400 line-through">
            {originalPrice}
          </p>
        )}
        {savings && promoEnds && (
          <p className="text-xs text-turquoise-700 font-medium">
            {savings} · ends {promoEnds}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-turquoise-700">
          {cta.label}
          <ChevronRight size={14} />
        </span>
      </div>
    </div>
  )
  if (cta.external) {
    return (
      <a href={cta.href} className="block h-full">
        {content}
      </a>
    )
  }
  return (
    <Link href={cta.href} className="block h-full">
      {content}
    </Link>
  )
}
