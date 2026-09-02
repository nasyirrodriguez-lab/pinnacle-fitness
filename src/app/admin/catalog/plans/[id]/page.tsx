import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
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
      'id, name, description, price_cents, discounted_price_cents, discount_expires_at, discount_label, currency, billing_period, features, is_active, is_private, is_specialized, group_size, pt_sessions_per_month, includes_open_gym, open_gym_visits_per_month'
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
    ptSessionsPerMonth: (row.pt_sessions_per_month as number | null) ?? null,
    includesOpenGym: (row.includes_open_gym as boolean) ?? false,
    openGymVisitsPerMonth: (row.open_gym_visits_per_month as number | null) ?? null,
  }
}


export default async function AdminPlanEditPage({ params }: PageProps) {
  const { id } = await params
  const plan = await loadPlan(id)
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
        <PlanEditForm plan={plan} />
      </div>

      <ProductDeleteButton kind="plan" id={plan.id} name={plan.name} />
    </div>
  )
}
