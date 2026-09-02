import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { ChevronLeft, Check } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getCreditBalanceCents } from '@/lib/credits/balance'
import { crewDiscountCentsFor } from '@/lib/referrals/crew-discount'
import PayPassButton from '@/components/checkout/pay-pass-button'
import {
  effectivePrice,
  fmtTtd,
  fmtSavings,
  fmtPromoEndShort,
} from '@/lib/pricing/effective'

export const dynamic = 'force-dynamic'

interface PassDetail {
  id: string
  name: string
  description: string | null
  price_cents: number
  discounted_price_cents: number | null
  discount_expires_at: string | null
  currency: string
  uses_total: number
  validity_days: number
  features: string[]
}

async function loadPass(id: string): Promise<PassDetail | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data, error } = await supabase
    .from('passes')
    .select(
      'id, name, description, price_cents, discounted_price_cents, discount_expires_at, currency, uses_total, validity_days, features'
    )
    .eq('id', id)
    .eq('is_active', true)
    .eq('is_private', false)
    .maybeSingle()
  if (error || !data) return null
  const row = data as Record<string, unknown>
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    price_cents: row.price_cents as number,
    discounted_price_cents:
      (row.discounted_price_cents as number | null) ?? null,
    discount_expires_at: (row.discount_expires_at as string | null) ?? null,
    currency: row.currency as string,
    uses_total: row.uses_total as number,
    validity_days: row.validity_days as number,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
  }
}

interface PageProps {
  params: Promise<{ itemId: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { itemId } = await params
  const pass = await loadPass(itemId)
  if (!pass) return { title: 'Pack not found — Pinnacle Fitness' }
  return {
    title: `${pass.name} — Pinnacle Fitness`,
    description: pass.description ?? undefined,
  }
}

export default async function BuyPassPage({ params }: PageProps) {
  const { itemId } = await params
  const [pass, user] = await Promise.all([loadPass(itemId), getCurrentUser()])
  const creditCents = user
    ? await getCreditBalanceCents(createAdminClient(), user.id)
    : 0
  if (!pass) notFound()

  const priced = effectivePrice(pass)

  // "Bring your crew": referred members get $10 off their first pass.
  // Computed server-side with the same helper the checkout charge uses,
  // so the price shown always matches the price billed.
  const crewOffCents = user
    ? await crewDiscountCentsFor(createAdminClient(), user.id)
    : 0

  const finalCents = Math.max(0, priced.effectiveCents - crewOffCents)
  const finalPrice = fmtTtd(finalCents)
  const originalPrice = priced.isDiscountActive
    ? fmtTtd(priced.regularCents)
    : null
  const savingsLabel = fmtSavings(priced)
  const promoEndsLabel = priced.isDiscountActive
    ? fmtPromoEndShort(priced.expiresAt)
    : null

  const signInHref = `/sign-in?next=${encodeURIComponent(`/buy/${pass.id}`)}`

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
      <Link
        href="/buy"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-6"
      >
        <ChevronLeft size={16} />
        All packs
      </Link>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="p-6 md:p-8 border-b border-neutral-200">
          <p className="text-xs uppercase tracking-wide text-turquoise-700 font-medium mb-2">
            You&apos;re buying
          </p>
          <h1 className="font-heading text-3xl md:text-4xl mb-3">
            {pass.name}
          </h1>
          {pass.description && (
            <p className="text-neutral-600">{pass.description}</p>
          )}
        </div>

        <div className="p-6 md:p-8 border-b border-neutral-200">
          <dl className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Sessions included
              </dt>
              <dd className="font-medium text-base">
                {pass.uses_total} {pass.uses_total === 1 ? 'session' : 'sessions'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Valid for
              </dt>
              <dd className="font-medium text-base">
                {pass.validity_days} days from purchase
              </dd>
            </div>
          </dl>
        </div>

        {pass.features.length > 0 && (
          <div className="p-6 md:p-8 border-b border-neutral-200">
            <h2 className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
              What&apos;s included
            </h2>
            <ul className="space-y-2">
              {pass.features.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-neutral-700">
                  <Check
                    size={16}
                    className="text-turquoise-600 mt-0.5 shrink-0"
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-6 md:p-8 bg-neutral-50">
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-sm text-neutral-600">Total</span>
            <div className="text-right">
              {originalPrice && (
                <p className="text-sm text-neutral-400 line-through">
                  {originalPrice}
                </p>
              )}
              <p className="font-heading text-3xl">{finalPrice}</p>
              {crewOffCents > 0 && (
                <p className="text-xs text-lime-700 font-medium mt-1">
                  Referral discount: −{fmtTtd(crewOffCents)} on your first pack
                </p>
              )}
              {savingsLabel && promoEndsLabel && (
                <p className="text-xs text-turquoise-700 font-medium mt-1">
                  {savingsLabel} · ends {promoEndsLabel}
                </p>
              )}
            </div>
          </div>

          {user ? (
            <>
              {creditCents > 0 && (
                <p className="mb-2 text-sm text-lime-800 bg-lime-50 border border-lime-200 rounded-md px-3 py-2">
                  You have TTD ${(creditCents / 100).toFixed(0)} account credit
                  {creditCents >= finalCents
                    ? ' — it covers this pass, no card needed.'
                    : ' — it applies at checkout.'}
                </p>
              )}
              <PayPassButton
                passId={pass.id}
                priceLabel={finalPrice}
                fullWidth
              />
              <p className="text-xs text-neutral-500 text-center mt-3">
                You&apos;ll be taken to Wam to enter your card.
              </p>
            </>
          ) : (
            <Link href={signInHref} className="block">
              <button
                type="button"
                className="w-full bg-turquoise-500 hover:bg-turquoise-600 text-white font-medium py-3 rounded-md transition"
              >
                Sign in to pay {finalPrice}
              </button>
              <p className="text-xs text-neutral-500 text-center mt-3">
                We&apos;ll email you a one-time sign-in link — no password.
              </p>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
