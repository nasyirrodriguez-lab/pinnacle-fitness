import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { parseRoomBenefits } from '@/lib/booking/plan-benefits'
import PlanEditForm from '@/components/admin/plan-edit-form'
import ProductDeleteButton from '@/components/admin/product-delete-button'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

async function loadPlan(id: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('plans')
    .select(
      'id, name, description, price_cents, discounted_price_cents, discount_expires_at, discount_label, currency, billing_period, features, is_active, is_private, is_specialized, group_size, includes_day_access, room_benefits'
    )
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  const row = data as Record<string, unknown>
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? '',
    priceCents: row.price_cents as number,
    discountedPriceCents: (row.discounted_price_cents as number | null) ?? null,
    discountExpiresAt: (row.discount_expires_at as string | null) ?? null,
    discountLabel: (row.discount_label as string | null) ?? null,
    currency: row.currency as string,
    billingPeriod: row.billing_period as string,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
    isActive: (row.is_active as boolean) ?? false,
    isPrivate: (row.is_private as boolean) ?? false,
    isSpecialized: (row.is_specialized as boolean) ?? false,
    groupSize: (row.group_size as number | null) ?? null,
    includesDayAccess: (row.includes_day_access as boolean) ?? true,
    roomBenefits: parseRoomBenefits(row.room_benefits),
  }
}

async function loadResources() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('resources')
    .select('id, name, is_bookable')
    .order('display_order', { ascending: true })
  return (
    (data as { id: string; name: string; is_bookable: boolean }[] | null) ?? []
  ).map((r) => ({
    id: r.id,
    name: r.is_bookable ? r.name : `${r.name} (access only)`,
  }))
}

export default async function AdminPlanEditPage({ params }: PageProps) {
  const { id } = await params
  const [plan, resources] = await Promise.all([loadPlan(id), loadResources()])
  if (!plan) notFound()

  return (
    <div>
      <Link
        href="/admin/catalog"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ChevronLeft size={16} />
        Catalog
      </Link>

      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
          Edit plan
        </p>
        <h1 className="font-heading text-3xl mb-1">{plan.name}</h1>
        <p className="text-sm text-neutral-500">
          ID: <span className="font-mono">{plan.id}</span> · Billing:{' '}
          {plan.billingPeriod} · Currency: {plan.currency}
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6 max-w-2xl">
        <PlanEditForm plan={plan} resources={resources} />
      </div>

      <ProductDeleteButton kind="plan" id={plan.id} name={plan.name} />
    </div>
  )
}
