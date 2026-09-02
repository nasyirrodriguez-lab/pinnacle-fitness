import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { cn } from '@/lib/utils'
import CatalogCreate from '@/components/admin/catalog-create'

export const dynamic = 'force-dynamic'

interface PlanRow {
  id: string
  name: string
  priceCents: number
  currency: string
  billingPeriod: string
  isActive: boolean
}

interface PassRow {
  id: string
  name: string
  priceCents: number
  discountedPriceCents: number | null
  currency: string
  usesTotal: number
  isActive: boolean
}

interface ResourceRow {
  id: string
  name: string
  kind: string
  pricePerHourCents: number | null
  currency: string
  capacity: number
  isBookable: boolean
  requiresContact: boolean
}

async function loadCatalog() {
  const admin = createAdminClient()
  const [{ data: plans }, { data: passes }, { data: resources }] =
    await Promise.all([
      admin
        .from('plans')
        .select('id, name, price_cents, currency, billing_period, is_active')
        .order('display_order', { ascending: true }),
      admin
        .from('passes')
        .select(
          'id, name, price_cents, discounted_price_cents, currency, uses_total, is_active'
        )
        .order('display_order', { ascending: true }),
      admin
        .from('resources')
        .select(
          'id, name, kind, price_per_hour_cents, currency, capacity, is_bookable, requires_contact'
        )
        .order('display_order', { ascending: true }),
    ])

  const mapped: {
    plans: PlanRow[]
    passes: PassRow[]
    resources: ResourceRow[]
  } = {
    plans: ((plans as Record<string, unknown>[] | null) ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      priceCents: r.price_cents as number,
      currency: r.currency as string,
      billingPeriod: r.billing_period as string,
      isActive: (r.is_active as boolean) ?? false,
    })),
    passes: ((passes as Record<string, unknown>[] | null) ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      priceCents: r.price_cents as number,
      discountedPriceCents: (r.discounted_price_cents as number | null) ?? null,
      currency: r.currency as string,
      usesTotal: r.uses_total as number,
      isActive: (r.is_active as boolean) ?? false,
    })),
    resources: ((resources as Record<string, unknown>[] | null) ?? []).map(
      (r) => ({
        id: r.id as string,
        name: r.name as string,
        kind: r.kind as string,
        pricePerHourCents: (r.price_per_hour_cents as number | null) ?? null,
        currency: r.currency as string,
        capacity: r.capacity as number,
        isBookable: (r.is_bookable as boolean) ?? false,
        requiresContact: (r.requires_contact as boolean) ?? false,
      })
    ),
  }
  return mapped
}

function fmtPrice(cents: number, currency = 'TTD'): string {
  return `${currency} $${(cents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        active ? 'bg-green-500' : 'bg-neutral-300'
      )}
      aria-label={active ? 'Active' : 'Inactive'}
    />
  )
}

function ListRow({
  href,
  primary,
  secondary,
  tertiary,
  badge,
}: {
  href: string
  primary: string
  secondary: string
  tertiary?: string
  badge?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 transition border-b border-neutral-100 last:border-0"
    >
      <div className="min-w-0 flex-1 flex items-center gap-3">
        {badge}
        <div className="min-w-0">
          <p className="font-medium text-sm">{primary}</p>
          <p className="text-xs text-neutral-500">{secondary}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 whitespace-nowrap">
        {tertiary && (
          <span className="text-sm text-neutral-600">{tertiary}</span>
        )}
        <ArrowRight size={16} className="text-neutral-400" />
      </div>
    </Link>
  )
}

export default async function AdminCatalogPage() {
  const { plans, passes, resources } = await loadCatalog()

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl mb-1">Packages</h1>
          <p className="text-neutral-600">
            Plans, passes, deals, and bookable rooms. Changes go live
            immediately on /spaces, /buy, and /book.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/admin/catalog/codes"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-darkOrange-300 text-darkOrange-800 rounded-md hover:border-darkOrange-500"
          >
            Discount codes
          </Link>
          <Link
            href="/admin/catalog/discounts"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-darkOrange-600 text-white rounded-md hover:bg-darkOrange-700"
          >
            Apply a discount
          </Link>
        </div>
      </div>

      <div className="mb-8">
        <CatalogCreate />
      </div>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
          Plans ({plans.length})
        </h2>
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          {plans.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">No plans.</p>
          ) : (
            plans.map((p) => (
              <ListRow
                key={p.id}
                href={`/admin/catalog/plans/${p.id}`}
                primary={p.name}
                secondary={`${p.id} · per ${p.billingPeriod}`}
                tertiary={fmtPrice(p.priceCents, p.currency)}
                badge={<StatusDot active={p.isActive} />}
              />
            ))
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
          Passes ({passes.length})
        </h2>
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          {passes.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">No passes.</p>
          ) : (
            passes.map((p) => (
              <ListRow
                key={p.id}
                href={`/admin/catalog/passes/${p.id}`}
                primary={p.name}
                secondary={`${p.id} · ${p.usesTotal} ${
                  p.usesTotal === 1 ? 'day' : 'days'
                }`}
                tertiary={
                  p.discountedPriceCents != null
                    ? `${fmtPrice(p.discountedPriceCents, p.currency)} (was ${fmtPrice(p.priceCents, p.currency)})`
                    : fmtPrice(p.priceCents, p.currency)
                }
                badge={<StatusDot active={p.isActive} />}
              />
            ))
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
          Resources ({resources.length})
        </h2>
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          {resources.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">No resources.</p>
          ) : (
            resources.map((r) => (
              <ListRow
                key={r.id}
                href={`/admin/catalog/resources/${r.id}`}
                primary={r.name}
                secondary={`${r.id} · ${r.kind} · up to ${r.capacity}`}
                tertiary={
                  r.pricePerHourCents
                    ? `${fmtPrice(r.pricePerHourCents, r.currency)}/hr`
                    : r.requiresContact
                      ? 'Inquire'
                      : '—'
                }
                badge={
                  <StatusDot active={r.isBookable && !r.requiresContact} />
                }
              />
            ))
          )}
        </div>
      </section>

      <p className="text-xs text-neutral-500">
        Catalog items can be deactivated but not deleted from the UI — existing
        bookings, passes, and subscriptions reference these rows. For permanent
        removal, drop via the Supabase SQL editor after checking dependents.
      </p>
    </div>
  )
}
