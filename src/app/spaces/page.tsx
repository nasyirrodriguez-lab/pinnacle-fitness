import Link from 'next/link'
import type { Metadata } from 'next'
import { Fragment } from 'react'
import { cookies } from 'next/headers'
import { Check, Phone, MailOpen, Users, Calendar } from 'lucide-react'
import { Inquire } from '@/components/ctas/ctas'
import Inclusions from '@/components/inclusions/inclusions'
import Faqs from '@/components/faqs/faqs'
import PageHeader from '@/components/page-header/page-header'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/server'
import { getBaseUrl } from '@/utils/getBaseUrl'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  effectivePrice,
  fmtSavings,
  fmtPromoEndShort,
} from '@/lib/pricing/effective'

export const dynamic = 'force-dynamic'

const baseUrl = getBaseUrl()

export const metadata: Metadata = {
  title: 'Pricing & Spaces | The Worx',
  description:
    'Explore every workspace at The Worx coworking space in Port of Spain — hot desks, dedicated desks, private offices, meeting rooms, conference rooms, and our event space. See pricing and book in one place.',
  alternates: { canonical: `${baseUrl}/spaces` },
  openGraph: {
    title: 'Pricing & Spaces | The Worx',
    description:
      'Every workspace at The Worx with capacity, pricing, and how to book — in one place.',
    url: `${baseUrl}/spaces`,
  },
}

interface CatalogPlan {
  id: string
  name: string
  description: string | null
  price_cents: number
  discounted_price_cents: number | null
  discount_expires_at: string | null
  currency: string
  billing_period: string
  features: string[]
  group_size: number | null
}

interface CatalogPass {
  id: string
  name: string
  description: string | null
  price_cents: number
  discounted_price_cents: number | null
  discount_expires_at: string | null
  currency: string
  uses_total: number
  features: string[]
  group_size: number | null
}

interface CatalogResource {
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

// Physical inventory counts — sourced from the constants file historically.
// Kept inline here because the marketing page is the only consumer.
const INVENTORY = {
  hotDeskSeats: 18,
  dedicatedDesks: 12,
  privateOffices: 1,
  cornerOffices: 1,
  phoneBooths: 4,
  meetingRooms: 2,
  conferenceRooms: 1,
  eventSpaces: 1,
} as const

function formatTtd(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} TTD`
}

interface PromoLabels {
  priceLabel: string
  strikethroughPrice?: string
  promoLabel?: string
}

function priceLabels(item: {
  price_cents: number
  discounted_price_cents: number | null
  discount_expires_at: string | null
}): PromoLabels {
  const p = effectivePrice(item)
  if (p.isDiscountActive) {
    const savings = fmtSavings(p)
    const ends = fmtPromoEndShort(p.expiresAt)
    return {
      priceLabel: formatTtd(p.effectiveCents),
      strikethroughPrice: formatTtd(p.regularCents),
      promoLabel: savings && ends ? `${savings} · ends ${ends}` : undefined,
    }
  }
  return { priceLabel: formatTtd(p.effectiveCents) }
}

async function loadCatalog(): Promise<{
  plans: CatalogPlan[]
  passes: CatalogPass[]
  resources: CatalogResource[]
}> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const [{ data: plansData }, { data: passesData }, { data: resourcesData }] =
    await Promise.all([
      supabase
        .from('plans')
        .select(
          'id, name, description, price_cents, discounted_price_cents, discount_expires_at, currency, billing_period, features, group_size'
        )
        .eq('is_active', true)
        .eq('is_private', false)
        .order('display_order', { ascending: true }),
      supabase
        .from('passes')
        .select(
          'id, name, description, price_cents, discounted_price_cents, discount_expires_at, currency, uses_total, features, group_size'
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

  const mapFeatures = (raw: unknown): string[] =>
    Array.isArray(raw) ? (raw as string[]) : []

  return {
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
        features: mapFeatures(row.features),
        group_size: (row.group_size as number | null) ?? null,
      })
    ),
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
        features: mapFeatures(row.features),
        group_size: (row.group_size as number | null) ?? null,
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

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string
  title: string
  description?: string
}) {
  return (
    <div className="mb-10 max-w-2xl">
      {eyebrow && (
        <p className="text-sm font-medium text-turquoise-700 uppercase tracking-wide mb-2">
          {eyebrow}
        </p>
      )}
      <h2 className="font-heading text-3xl md:text-4xl mb-3">{title}</h2>
      {description && (
        <p className="text-neutral-600 leading-relaxed">{description}</p>
      )}
    </div>
  )
}

interface OfferingCardProps {
  name: string
  inventoryLabel?: string
  priceLabel: string
  priceSubtext?: string
  strikethroughPrice?: string
  promoLabel?: string
  description: string
  features: string[]
  cta: {
    href: string
    label: string
    secondary?: { href: string; label: string }
  }
  highlight?: boolean
}

function OfferingCard({
  name,
  inventoryLabel,
  priceLabel,
  priceSubtext,
  strikethroughPrice,
  promoLabel,
  description,
  features,
  cta,
  highlight,
}: OfferingCardProps) {
  return (
    <div
      className={`bg-white border-2 rounded-lg p-6 flex flex-col h-full ${
        highlight ? 'border-turquoise-500' : 'border-neutral-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-heading text-xl">{name}</h3>
        {inventoryLabel && (
          <span className="shrink-0 px-2 py-0.5 bg-neutral-100 text-neutral-700 text-xs rounded font-medium">
            {inventoryLabel}
          </span>
        )}
      </div>

      <div className="mb-4">
        <p className="font-heading text-3xl">{priceLabel}</p>
        {strikethroughPrice && (
          <p className="text-sm text-neutral-400 line-through">
            {strikethroughPrice}
          </p>
        )}
        {promoLabel && (
          <p className="text-xs text-turquoise-700 font-medium mt-1">
            {promoLabel}
          </p>
        )}
        {priceSubtext && (
          <p className="text-xs text-neutral-500 mt-1">{priceSubtext}</p>
        )}
      </div>

      <p className="text-sm text-neutral-600 mb-4">{description}</p>

      <ul className="space-y-2 text-sm text-neutral-700 mb-6">
        {features.map((f, i) => (
          <li key={i} className="flex gap-2">
            <Check size={16} className="text-turquoise-600 mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-2">
        <Link href={cta.href}>
          <Button
            variant={highlight ? 'default' : 'outline'}
            className="w-full"
          >
            {cta.label}
          </Button>
        </Link>
        {cta.secondary && (
          <Link
            href={cta.secondary.href}
            className="block text-xs text-center text-neutral-500 hover:text-neutral-900 underline"
          >
            {cta.secondary.label}
          </Link>
        )}
      </div>
    </div>
  )
}

export default async function SpacesPage() {
  const [{ plans, passes, resources }, currentUser] = await Promise.all([
    loadCatalog(),
    getCurrentUser(),
  ])

  const isSignedIn = currentUser !== null

  // Self-serve plans go through Wam checkout; others have product-specific CTAs.
  const SELF_SERVE_PLAN_IDS = new Set([
    'hot-desk-monthly',
    'dedicated-desk-monthly',
  ])

  const planCta = (
    planId: string
  ): {
    href: string
    label: string
    secondary?: { href: string; label: string }
  } => {
    if (
      planId === 'private-office-monthly' ||
      planId === 'corner-office-monthly'
    ) {
      const subject =
        planId === 'corner-office-monthly'
          ? 'Corner%20Office%20inquiry'
          : 'Private%20Office%20inquiry'
      return {
        href: 'tel:+18682810830',
        label: 'Call for availability',
        secondary: {
          href: `mailto:team@theworx.io?subject=${subject}`,
          label: 'Or email us',
        },
      }
    }
    if (planId === 'virtual-office-monthly') {
      return { href: '/virtual-office', label: 'Get started' }
    }
    if (SELF_SERVE_PLAN_IDS.has(planId)) {
      if (!isSignedIn) {
        return {
          href: `/sign-up?next=${encodeURIComponent(`/subscribe/${planId}`)}`,
          label: 'Subscribe',
        }
      }
      return { href: `/subscribe/${planId}`, label: 'Subscribe' }
    }
    return {
      href: 'mailto:team@theworx.io?subject=Plan%20inquiry',
      label: 'Email team to start',
    }
  }

  // Index by id for quick lookup. Lets us colocate plans + passes + resources
  // inside a single product card.
  const planById = new Map(plans.map((p) => [p.id, p]))
  const passById = new Map(passes.map((p) => [p.id, p]))
  const resourceById = new Map(resources.map((r) => [r.id, r]))

  const hotDeskPlan = planById.get('hot-desk-monthly')
  const dedicatedDeskPlan = planById.get('dedicated-desk-monthly')
  const privateOfficePlan = planById.get('private-office-monthly')
  const cornerOfficePlan = planById.get('corner-office-monthly')
  const virtualOfficePlan = planById.get('virtual-office-monthly')

  const dayPass = passById.get('day-pass')
  const fiveDayPass = passById.get('5-day-pass')
  const tenDayPass = passById.get('10-day-pass')
  const dayPasses = [dayPass, fiveDayPass, tenDayPass].filter(
    (p): p is CatalogPass => Boolean(p)
  )
  // Anything else that's active + public — group passes, future specials —
  // renders automatically instead of needing a code change.
  const featuredPassIds = new Set(['day-pass', '5-day-pass', '10-day-pass'])
  const otherPasses = passes.filter((p) => !featuredPassIds.has(p.id))
  const featuredPlanIds = new Set([
    'hot-desk-monthly',
    'dedicated-desk-monthly',
    'private-office-monthly',
    'corner-office-monthly',
    'virtual-office-monthly',
  ])
  const otherPlans = plans.filter((p) => !featuredPlanIds.has(p.id))

  const meetingRoom1 = resourceById.get('meeting-room')
  const meetingRoom2 = resourceById.get('meeting-room-2')
  const conferenceRoom = resourceById.get('conference-room')
  const coworkingEventSpace = resourceById.get('event-space')
  const rooftopEventSpace = resourceById.get('rooftop-event-space')
  const eventVenues = [coworkingEventSpace, rooftopEventSpace].filter(
    (r): r is CatalogResource => Boolean(r)
  )
  const meetingRooms = [meetingRoom1, meetingRoom2].filter(
    (r): r is CatalogResource => Boolean(r)
  )

  return (
    <Fragment>
      <PageHeader
        title="Pricing & Spaces"
        description="Every workspace at The Worx — what's available, how many we have, and what it costs. From a drop-in day pass to a private office, find the right fit."
        image={{
          src: '/images/desks.jpg',
          alt: 'Workspace at The Worx coworking space',
        }}
      />

      {/* ================== Work Stations ================== */}
      <section id="work-stations" className="py-16 bg-neutral-50 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <SectionHeading
            eyebrow="Work stations"
            title="Find a seat or a permanent desk."
            description="Drop in for the day, come every weekday, or claim a desk that's always yours. Every membership and pass includes high-speed Wi-Fi, common areas, printing, and access to the collab nooks."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {hotDeskPlan &&
              (() => {
                const labels = priceLabels(hotDeskPlan)
                return (
                  <OfferingCard
                    name="Hot Desks"
                    inventoryLabel={`${INVENTORY.hotDeskSeats} seats`}
                    priceLabel={labels.priceLabel}
                    strikethroughPrice={labels.strikethroughPrice}
                    promoLabel={labels.promoLabel}
                    priceSubtext={`per ${hotDeskPlan.billing_period} · or buy a day pass below`}
                    description="Casual seating for drop-ins, day passes, or monthly access. First-come, first-served."
                    features={hotDeskPlan.features}
                    cta={planCta(hotDeskPlan.id)}
                    highlight
                  />
                )
              })()}
            {dedicatedDeskPlan &&
              (() => {
                const labels = priceLabels(dedicatedDeskPlan)
                return (
                  <OfferingCard
                    name="Dedicated Desks"
                    inventoryLabel={`${INVENTORY.dedicatedDesks} desks`}
                    priceLabel={labels.priceLabel}
                    strikethroughPrice={labels.strikethroughPrice}
                    promoLabel={labels.promoLabel}
                    priceSubtext={`per ${dedicatedDeskPlan.billing_period}`}
                    description="Your own desk, every time you come in. Leave your monitor, books, plants — it's yours."
                    features={dedicatedDeskPlan.features}
                    cta={planCta(dedicatedDeskPlan.id)}
                  />
                )
              })()}
          </div>

          {dayPasses.length > 0 && (
            <div className="mt-10">
              <h3 className="font-heading text-xl mb-2">
                Or pay as you go &mdash; day passes
              </h3>
              <p className="text-sm text-neutral-600 mb-5">
                No subscription. Use any time within 12 months of purchase. Day
                passes get you the same hot-desk access as monthly members.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {dayPasses.map((pass) => {
                  const labels = priceLabels(pass)
                  return (
                    <OfferingCard
                      key={pass.id}
                      name={pass.name}
                      inventoryLabel={
                        pass.uses_total === 1
                          ? '1 day'
                          : `${pass.uses_total} days`
                      }
                      priceLabel={labels.priceLabel}
                      strikethroughPrice={labels.strikethroughPrice}
                      promoLabel={labels.promoLabel}
                      priceSubtext={
                        pass.uses_total === 1
                          ? 'single day'
                          : `${pass.uses_total} day-uses`
                      }
                      description={pass.description ?? ''}
                      features={pass.features}
                      cta={{ href: `/buy/${pass.id}`, label: 'Buy now' }}
                      highlight={pass.id === 'day-pass'}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {otherPasses.length > 0 && (
            <div className="mt-10">
              <h3 className="font-heading text-xl mb-2">
                Group &amp; specialty passes
              </h3>
              <p className="text-sm text-neutral-600 mb-5">
                Bring the whole crew — one pass covers everyone, and each person
                checks in on the iPad when they arrive.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {otherPasses.map((pass) => {
                  const labels = priceLabels(pass)
                  return (
                    <OfferingCard
                      key={pass.id}
                      name={pass.name}
                      inventoryLabel={
                        pass.group_size
                          ? `${pass.group_size} people`
                          : pass.uses_total === 1
                            ? '1 day'
                            : `${pass.uses_total} days`
                      }
                      priceLabel={labels.priceLabel}
                      strikethroughPrice={labels.strikethroughPrice}
                      promoLabel={labels.promoLabel}
                      priceSubtext={
                        pass.group_size
                          ? `covers ${pass.group_size} people`
                          : pass.uses_total === 1
                            ? 'single day'
                            : `${pass.uses_total} day-uses`
                      }
                      description={pass.description ?? ''}
                      features={pass.features}
                      cta={{ href: `/buy/${pass.id}`, label: 'Buy now' }}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ================== Private Offices ================== */}
      {(privateOfficePlan || cornerOfficePlan) && (
        <section id="private-offices" className="py-16 bg-white scroll-mt-24">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <SectionHeading
              eyebrow="Private offices"
              title="A room of your own."
              description="For founders, small teams, and anyone who wants their own door. Furnished, ready to move in."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {privateOfficePlan &&
                (() => {
                  const labels = priceLabels(privateOfficePlan)
                  return (
                    <OfferingCard
                      name="Private Office"
                      inventoryLabel={`${INVENTORY.privateOffices} available`}
                      priceLabel={labels.priceLabel}
                      strikethroughPrice={labels.strikethroughPrice}
                      promoLabel={labels.promoLabel}
                      priceSubtext={`per ${privateOfficePlan.billing_period} · seats up to 6`}
                      description="A private, lockable office for your team. Includes everything in the membership tier plus the privacy of your own space."
                      features={privateOfficePlan.features}
                      cta={planCta(privateOfficePlan.id)}
                    />
                  )
                })()}
              {cornerOfficePlan &&
                (() => {
                  const labels = priceLabels(cornerOfficePlan)
                  return (
                    <OfferingCard
                      name="Corner Office"
                      inventoryLabel={`${INVENTORY.cornerOffices} available`}
                      priceLabel={labels.priceLabel}
                      strikethroughPrice={labels.strikethroughPrice}
                      promoLabel={labels.promoLabel}
                      priceSubtext={`per ${cornerOfficePlan.billing_period} · corner suite`}
                      description="Our largest private office — a corner suite with windows on two sides for extra natural light and room for a bigger team."
                      features={cornerOfficePlan.features}
                      cta={planCta(cornerOfficePlan.id)}
                      highlight
                    />
                  )
                })()}
            </div>
          </div>
        </section>
      )}

      {/* ================== Virtual Office ================== */}
      {virtualOfficePlan && (
        <section
          id="virtual-office"
          className="py-16 bg-neutral-50 scroll-mt-24"
        >
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <SectionHeading
              eyebrow="Virtual office"
              title="A professional address, no office required."
              description="Use The Worx as your registered business address in Port of Spain. We accept your mail, photograph it, and notify you — you collect or forward it on your schedule."
            />
            <div className="max-w-2xl">
              {(() => {
                const labels = priceLabels(virtualOfficePlan)
                return (
                  <OfferingCard
                    name="Virtual Office"
                    inventoryLabel="Digital"
                    priceLabel={labels.priceLabel}
                    strikethroughPrice={labels.strikethroughPrice}
                    promoLabel={labels.promoLabel}
                    priceSubtext={`per ${virtualOfficePlan.billing_period}`}
                    description="Registered business address + mail handling + dashboard inbox. Doesn't include physical workspace access."
                    features={virtualOfficePlan.features}
                    cta={planCta(virtualOfficePlan.id)}
                  />
                )
              })()}
            </div>
          </div>
        </section>
      )}

      {/* ================== More memberships ================== */}
      {otherPlans.length > 0 && (
        <section id="more-memberships" className="py-16 bg-white scroll-mt-24">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <SectionHeading
              eyebrow="More memberships"
              title="Specialty plans."
              description="Additional memberships beyond the core desks and offices."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {otherPlans.map((plan) => {
                const labels = priceLabels(plan)
                return (
                  <OfferingCard
                    key={plan.id}
                    name={plan.name}
                    inventoryLabel={
                      plan.group_size ? `${plan.group_size} people` : 'Plan'
                    }
                    priceLabel={labels.priceLabel}
                    strikethroughPrice={labels.strikethroughPrice}
                    promoLabel={labels.promoLabel}
                    priceSubtext={`per ${plan.billing_period}${plan.group_size ? ` · covers ${plan.group_size} people` : ''}`}
                    description={plan.description ?? ''}
                    features={plan.features}
                    cta={planCta(plan.id)}
                  />
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ================== Meeting Spaces ================== */}
      <section id="meeting-spaces" className="py-16 bg-white scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <SectionHeading
            eyebrow="Meeting spaces"
            title="Rooms for calls, meetings, and big-room moments."
            description="Reserve a meeting room or the conference room in 30-minute slots. Phone booths are first-come, first-served and free with any membership or day pass."
          />

          {meetingRooms.length > 0 && (
            <div className="mb-10">
              <h3 className="font-heading text-xl mb-4">Meeting rooms</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {meetingRooms.map((room) => (
                  <OfferingCard
                    key={room.id}
                    name={room.name}
                    inventoryLabel={`Up to ${room.capacity}`}
                    priceLabel={
                      room.price_per_hour_cents
                        ? formatTtd(room.price_per_hour_cents)
                        : '—'
                    }
                    priceSubtext="per hour · 30-min slots"
                    description={room.description ?? ''}
                    features={[
                      `Seats up to ${room.capacity} people`,
                      'Presentation equipment',
                      'High-speed Wi-Fi',
                      '30-minute booking slots',
                    ]}
                    cta={{
                      href: `/book/${room.id}`,
                      label: 'Book this room',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {conferenceRoom && (
            <div className="mb-10">
              <h3 className="font-heading text-xl mb-4">Conference room</h3>
              <div className="max-w-2xl">
                <OfferingCard
                  name={conferenceRoom.name}
                  inventoryLabel={`Up to ${conferenceRoom.capacity}`}
                  priceLabel={
                    conferenceRoom.price_per_hour_cents
                      ? formatTtd(conferenceRoom.price_per_hour_cents)
                      : '—'
                  }
                  priceSubtext="per hour · 30-min slots"
                  description={conferenceRoom.description ?? ''}
                  features={[
                    `Seats up to ${conferenceRoom.capacity} people`,
                    'Presentation equipment + AV system',
                    'High-speed Wi-Fi',
                    '30-minute booking slots',
                  ]}
                  cta={{
                    href: `/book/${conferenceRoom.id}`,
                    label: 'Book this room',
                  }}
                />
              </div>
            </div>
          )}

          {/* Phone booths: included with any access, not a paid resource on its own. */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-5 md:p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
              <Phone size={20} />
            </div>
            <div>
              <p className="font-heading text-base mb-1">
                Phone booths &mdash; included
              </p>
              <p className="text-sm text-neutral-600">
                {INVENTORY.phoneBooths} sound-proof booths for quick calls and
                video meetings. First-come, first-served. Free with any
                membership, day pass, or private office.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================== Events (co-branded) ================== */}
      {eventVenues.length > 0 && (
        <section id="events" className="py-16 bg-neutral-50 scroll-mt-24">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <SectionHeading
              eyebrow="Events"
              title="Let's host something together."
              description="We don't just rent the room — we partner with you on the event. Every event at The Worx is co-branded, and we work with you on programming, promotion, and the day-of details. Two venues to pick from."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {eventVenues.map((venue) => (
                <div
                  key={venue.id}
                  className="bg-white border-2 border-neutral-200 rounded-lg p-6 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-heading text-xl">{venue.name}</h3>
                    <span className="shrink-0 px-2 py-0.5 bg-neutral-100 text-neutral-700 text-xs rounded font-medium">
                      Up to {venue.capacity}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 mb-4 flex-1">
                    {venue.description ?? ''}
                  </p>
                  <p className="text-xs text-neutral-500 flex items-center gap-1.5 mb-4">
                    <Calendar size={12} />
                    {venue.id === 'rooftop-event-space'
                      ? 'Evenings & weekends · open-air'
                      : 'After 5pm weekdays · all day weekends'}
                  </p>
                  <p className="font-heading text-lg text-neutral-900 mb-1">
                    Call for pricing
                  </p>
                  <p className="text-xs text-neutral-500">
                    Pricing depends on event type, scale, and what we co-host
                    together. Get in touch and let&apos;s plan it.
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-neutral-900 text-white rounded-lg p-6 md:p-8">
              <p className="text-xs uppercase tracking-wide text-neutral-300 mb-2">
                Get in touch
              </p>
              <p className="font-heading text-xl mb-4">
                Tell us about your event and we&apos;ll work out the rest.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="tel:+18682810830"
                  className="inline-flex items-center justify-center px-5 py-3 bg-white text-neutral-900 font-medium rounded-md hover:bg-neutral-100 transition"
                >
                  Call +1 (868) 281-0830
                </a>
                <a
                  href="mailto:team@theworx.io?subject=Event%20inquiry"
                  className="inline-flex items-center justify-center px-5 py-3 border border-white/30 text-white font-medium rounded-md hover:bg-white/10 transition"
                >
                  Email team@theworx.io
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================== Included with everything ================== */}
      <section className="py-16 bg-white scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <SectionHeading
            eyebrow="Included with every membership"
            title="The bits everyone gets."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-5">
              <div className="w-10 h-10 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center mb-3">
                <Users size={20} />
              </div>
              <p className="font-heading text-base mb-1">Collab nooks</p>
              <p className="text-sm text-neutral-600">
                Casual seating areas with whiteboards and monitors for
                brainstorming and side conversations.
              </p>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-5">
              <div className="w-10 h-10 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center mb-3">
                <Phone size={20} />
              </div>
              <p className="font-heading text-base mb-1">Phone booths</p>
              <p className="text-sm text-neutral-600">
                {INVENTORY.phoneBooths} sound-proof booths for calls and video
                meetings. First-come, first-served.
              </p>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-5">
              <div className="w-10 h-10 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center mb-3">
                <MailOpen size={20} />
              </div>
              <p className="font-heading text-base mb-1">
                Wi-Fi, printing, coffee
              </p>
              <p className="text-sm text-neutral-600">
                High-speed Wi-Fi, on-demand printing and scanning, and great
                coffee within walking distance.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Inclusions />

      <section className="py-24 px-6 md:px-12 bg-white">
        <div className="max-w-4xl mx-auto">
          <Faqs />
        </div>
      </section>

      <section className="py-16 bg-neutral-900 text-white">
        <div className="max-w-3xl mx-auto px-6 md:px-12 text-center">
          <h2 className="font-heading text-3xl mb-3">
            Ready to find your workspace?
          </h2>
          <p className="text-neutral-300 mb-6">
            Tell us what you need and we&apos;ll help you get set up.
          </p>
          <Inquire />
        </div>
      </section>
    </Fragment>
  )
}
