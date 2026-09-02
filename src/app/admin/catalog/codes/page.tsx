import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import DiscountCodesManager, {
  type CodeProduct,
  type DiscountCodeRow,
} from '@/components/admin/discount-codes-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Discount codes — Admin',
}

async function loadData(): Promise<{
  codes: DiscountCodeRow[]
  products: CodeProduct[]
}> {
  const admin = createAdminClient()
  const [{ data: codeRows }, { data: plans }, { data: passes }] =
    await Promise.all([
      admin
        .from('discount_codes')
        .select(
          'id, code, percent_off, applies_to, max_uses_per_member, expires_at, is_active'
        )
        .order('created_at', { ascending: false }),
      admin.from('plans').select('id, name').order('display_order'),
      admin.from('passes').select('id, name').order('display_order'),
    ])

  const codes = ((codeRows as Record<string, unknown>[] | null) ?? []).map(
    (r) => ({
      id: r.id as string,
      code: r.code as string,
      percentOff: r.percent_off as number,
      appliesTo: Array.isArray(r.applies_to)
        ? (r.applies_to as { kind: 'plan' | 'pass'; id: string }[])
        : [],
      maxUsesPerMember: (r.max_uses_per_member as number | null) ?? null,
      expiresAt: (r.expires_at as string | null) ?? null,
      isActive: (r.is_active as boolean) ?? false,
      uses: 0,
      revenueCents: 0,
      usage: [] as DiscountCodeRow['usage'],
    })
  )

  // Usage comes from payments metadata — one query, tallied per code
  // with who used it, when, and the revenue it brought in.
  if (codes.length > 0) {
    const { data: uses } = await admin
      .from('payments')
      .select(
        'metadata, amount_cents, status, paid_at, created_at, profiles!payments_user_id_fkey(full_name, email)'
      )
      .in('status', ['pending', 'succeeded'])
      .not('metadata->>discountCodeId', 'is', null)
      .order('created_at', { ascending: false })
    for (const row of (uses as Record<string, unknown>[] | null) ?? []) {
      const metadata = row.metadata as Record<string, unknown> | null
      const id = metadata?.discountCodeId as string | undefined
      const code = id ? codes.find((c) => c.id === id) : undefined
      if (!code) continue
      const profRaw = row.profiles as
        | { full_name?: string | null; email?: string }
        | { full_name?: string | null; email?: string }[]
        | null
      const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
      code.uses += 1
      if (row.status === 'succeeded') {
        code.revenueCents += (row.amount_cents as number) ?? 0
      }
      if (code.usage.length < 25) {
        code.usage.push({
          memberName: profile?.full_name?.trim() || profile?.email || 'Member',
          amountCents: (row.amount_cents as number) ?? 0,
          status: row.status as string,
          at: ((row.paid_at ?? row.created_at) as string) ?? '',
        })
      }
    }
  }

  const products: CodeProduct[] = [
    ...(((plans as { id: string; name: string }[] | null) ?? []).map((p) => ({
      kind: 'plan' as const,
      id: p.id,
      name: p.name,
    })) ?? []),
    ...(((passes as { id: string; name: string }[] | null) ?? []).map((p) => ({
      kind: 'pass' as const,
      id: p.id,
      name: p.name,
    })) ?? []),
  ]

  return { codes, products }
}

export default async function AdminDiscountCodesPage() {
  const { codes, products } = await loadData()

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
          Discount codes
        </h1>
        <p className="text-sm text-neutral-600 max-w-xl">
          Shareable codes members enter at checkout — online, on the iPad, or
          applied by an admin when recording a payment. Scope them to specific
          products, cap uses per member, and retire them when the promo ends.
        </p>
      </div>

      <DiscountCodesManager codes={codes} products={products} />
    </div>
  )
}
