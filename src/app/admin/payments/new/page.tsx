import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { effectivePrice } from '@/lib/pricing/effective'
import ManualPaymentForm from '@/components/admin/manual-payment-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Record payment — Admin',
}

interface PageProps {
  searchParams: Promise<{
    user?: string
    external_ref?: string
    amount?: string
  }>
}

interface MemberOption {
  id: string
  label: string
}
interface PassOption {
  id: string
  name: string
  priceCents: number
}
interface PlanOption {
  id: string
  name: string
  priceCents: number
}

async function loadCatalog(): Promise<{
  members: MemberOption[]
  passes: PassOption[]
  plans: PlanOption[]
  creditBalances: Record<string, number>
}> {
  const admin = createAdminClient()
  const [
    { data: profilesData },
    { data: passesData },
    { data: plansData },
    { data: ledgerData },
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, email')
      .eq('archived', false)
      .order('full_name', { ascending: true })
      .limit(2000),
    // Public products that are live, plus every private one — private
    // plans/passes exist precisely so management can apply them here.
    admin
      .from('passes')
      .select(
        'id, name, price_cents, discounted_price_cents, discount_expires_at, is_private'
      )
      .or('is_active.eq.true,is_private.eq.true')
      .order('display_order', { ascending: true }),
    admin
      .from('plans')
      .select(
        'id, name, price_cents, discounted_price_cents, discount_expires_at, is_private'
      )
      .or('is_active.eq.true,is_private.eq.true')
      .order('display_order', { ascending: true }),
    admin
      .from('credit_ledger')
      .select('user_id, balance_after_cents, created_at')
      .order('created_at', { ascending: false }),
  ])

  // Build a per-user latest-balance map from the ordered ledger.
  const creditBalances: Record<string, number> = {}
  for (const row of (ledgerData as Array<{
    user_id: string
    balance_after_cents: number
  }> | null) ?? []) {
    if (creditBalances[row.user_id] === undefined) {
      creditBalances[row.user_id] = row.balance_after_cents
    }
  }

  const members: MemberOption[] = (
    (profilesData as Array<{
      id: string
      full_name: string | null
      email: string
    }> | null) ?? []
  ).map((p) => ({
    id: p.id,
    label: p.full_name ? `${p.full_name} · ${p.email}` : p.email,
  }))
  const passes: PassOption[] = (
    (passesData as Array<{
      id: string
      name: string
      price_cents: number
      discounted_price_cents: number | null
      discount_expires_at: string | null
      is_private: boolean
    }> | null) ?? []
  ).map((p) => ({
    id: p.id,
    name: p.is_private ? `${p.name} · private` : p.name,
    priceCents: effectivePrice(p).effectiveCents,
  }))
  const plans: PlanOption[] = (
    (plansData as Array<{
      id: string
      name: string
      price_cents: number
      discounted_price_cents: number | null
      discount_expires_at: string | null
      is_private: boolean
    }> | null) ?? []
  ).map((p) => ({
    id: p.id,
    name: p.is_private ? `${p.name} · private` : p.name,
    priceCents: effectivePrice(p).effectiveCents,
  }))

  return { members, passes, plans, creditBalances }
}

export default async function NewPaymentPage({ searchParams }: PageProps) {
  const { user, external_ref, amount } = await searchParams
  const { members, passes, plans, creditBalances } = await loadCatalog()

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/payments"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ChevronLeft size={16} />
        Payments
      </Link>

      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Record a payment</h1>
        <p className="text-neutral-600">
          For cash, Wam POS card taps, bank transfers — anything that happened
          outside the online checkout. The product is granted to the member
          automatically once you save.
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <ManualPaymentForm
          members={members}
          passes={passes}
          plans={plans}
          creditBalances={creditBalances}
          defaultUserId={user}
          defaultExternalRef={external_ref}
          defaultAmountTtd={amount}
        />
      </div>

      <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-5 text-sm">
        <p className="font-medium mb-1 text-orange-900">
          A note on Wam POS card payments
        </p>
        <p className="text-orange-900/80">
          Wam&apos;s POS terminal doesn&apos;t send webhooks to this app, so
          card taps at the front desk don&apos;t auto-record. Paste the Wam
          reference ID (the long auth code) into the &quot;External
          reference&quot; field to reconcile after the fact &mdash; we&apos;ll
          block duplicates by that reference.
        </p>
      </div>
    </div>
  )
}
