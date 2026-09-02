import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import DiscountPanel, {
  type DiscountableProduct,
} from '@/components/admin/discount-panel'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Discounts — Admin',
}

async function loadProducts(): Promise<DiscountableProduct[]> {
  const admin = createAdminClient()
  const [{ data: plans }, { data: passes }] = await Promise.all([
    admin
      .from('plans')
      .select(
        'id, name, price_cents, discounted_price_cents, discount_label, discount_expires_at'
      )
      .order('display_order', { ascending: true }),
    admin
      .from('passes')
      .select(
        'id, name, price_cents, discounted_price_cents, discount_label, discount_expires_at'
      )
      .order('display_order', { ascending: true }),
  ])

  const map = (
    rows: Record<string, unknown>[] | null,
    kind: 'plan' | 'pass'
  ): DiscountableProduct[] =>
    (rows ?? []).map((r) => ({
      kind,
      id: r.id as string,
      name: r.name as string,
      priceCents: r.price_cents as number,
      discountedPriceCents: (r.discounted_price_cents as number | null) ?? null,
      discountLabel: (r.discount_label as string | null) ?? null,
      discountExpiresAt: (r.discount_expires_at as string | null) ?? null,
    }))

  return [
    ...map(plans as Record<string, unknown>[] | null, 'plan'),
    ...map(passes as Record<string, unknown>[] | null, 'pass'),
  ]
}

export default async function AdminDiscountsPage() {
  const products = await loadProducts()

  return (
    <div>
      <Link
        href="/admin/catalog"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ChevronLeft size={16} />
        Packages
      </Link>

      <div className="mb-6">
        <h1 className="font-heading text-2xl md:text-3xl mb-2">
          Apply a discount
        </h1>
        <p className="text-sm text-neutral-600 max-w-xl">
          Name the deal, set the percentage and an optional end date, then pick
          the plans and passes it covers. Prices on the public site update
          immediately; expired discounts stop applying on their own.
        </p>
      </div>

      <DiscountPanel products={products} />
    </div>
  )
}
