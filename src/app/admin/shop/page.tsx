import { createAdminClient } from '@/utils/supabase/admin'
import { fmtAstDateTime } from '@/lib/time/ast'
import { fmtTtd } from '@/lib/members/earnings'
import AdminShopManager, { type ProductRow } from '@/components/admin/admin-shop-manager'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Shop — Admin' }

export default async function AdminShopPage() {
  const admin = createAdminClient()
  const monthStart = new Date()
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const [{ data: products }, { data: sales }] = await Promise.all([
    admin.from('products').select('id, name, variant, price_cents, stock, is_active').order('display_order').order('name'),
    admin
      .from('sales')
      .select('id, quantity, total_cents, payment_method, created_at, products(name, variant), profiles!sales_user_id_fkey(full_name, email), seller:profiles!sales_sold_by_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(60),
  ])
  const rows: ProductRow[] = ((products as { id: string; name: string; variant: string; price_cents: number; stock: number; is_active: boolean }[] | null) ?? []).map((p) => ({
    id: p.id, name: p.name, variant: p.variant, priceCents: p.price_cents, stock: p.stock, isActive: p.is_active,
  }))
  type SaleRaw = {
    id: string; quantity: number; total_cents: number; payment_method: string; created_at: string
    products: { name?: string; variant?: string } | { name?: string; variant?: string }[] | null
    profiles: { full_name?: string | null; email?: string } | { full_name?: string | null; email?: string }[] | null
    seller: { full_name?: string | null; email?: string } | { full_name?: string | null; email?: string }[] | null
  }
  const one = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? (x[0] ?? null) : x)
  const saleRows = ((sales as SaleRaw[] | null) ?? []).map((s) => ({
    id: s.id,
    label: `${s.quantity}× ${one(s.products)?.name ?? '?'}${one(s.products)?.variant ? ` ${one(s.products)?.variant}` : ''}`,
    total: s.total_cents,
    method: s.payment_method,
    member: one(s.profiles)?.full_name ?? one(s.profiles)?.email ?? null,
    seller: one(s.seller)?.full_name ?? one(s.seller)?.email ?? '—',
    at: s.created_at,
  }))
  const monthTotal = saleRows.filter((s) => new Date(s.at) >= monthStart).reduce((sum, s) => sum + s.total, 0)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl mb-1">Shop</h1>
          <p className="text-neutral-600 max-w-xl">The fridge and the shelf. Set prices here; the iPad sells; stock counts itself. Sales go into the rent pool.</p>
        </div>
        <div className="bg-turquoise-500 text-black rounded-lg px-5 py-3"><p className="text-xs uppercase tracking-wide opacity-70">Sold this month</p><p className="font-stat text-2xl">{fmtTtd(monthTotal)}</p></div>
      </div>
      <AdminShopManager products={rows} />
      <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-neutral-200"><h2 className="font-heading text-lg">Recent sales</h2></div>
        {saleRows.length === 0 ? <p className="p-6 text-sm text-neutral-500">Nothing sold yet.</p> : (
          <ul className="divide-y divide-neutral-100">
            {saleRows.map((s) => (
              <li key={s.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0"><span className="font-medium">{s.label}</span><span className="text-xs text-neutral-500 block">{fmtAstDateTime(s.at)} · {s.method.replace('_', ' ')} · sold by {s.seller}{s.member && ` · ${s.member}`}</span></span>
                <span className="font-stat">{fmtTtd(s.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
