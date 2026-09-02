import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getBaseUrl } from '@/utils/getBaseUrl'
import { createClient } from '@/utils/supabase/server'
import { effectivePrice } from '@/lib/pricing/effective'
import PricingView, {
  type PricingItem,
} from '@/views/pricing-view/pricing-view'

const baseUrl = getBaseUrl()

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Flexible coworking membership plans starting at $100 TTD. Day passes, monthly hot desks, dedicated desks, and private offices in Port of Spain, Trinidad.',
  alternates: {
    canonical: `${baseUrl}/pricing`,
  },
  openGraph: {
    title: 'Pricing | The Worx',
    description:
      'Flexible coworking membership plans starting at $100 TTD. Day passes, monthly hot desks, dedicated desks, and private offices in Port of Spain, Trinidad.',
    url: `${baseUrl}/pricing`,
  },
}

interface CatalogRow {
  id: string
  name: string
  description: string | null
  price_cents: number
  discounted_price_cents: number | null
  discount_expires_at: string | null
  features: unknown
  is_specialized: boolean | null
}

function toItem(row: CatalogRow): PricingItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    price: effectivePrice(row).effectiveCents / 100,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
    specialized: row.is_specialized === true,
  }
}

// Live catalog: anything made active + public in the admin shows up here
// automatically, same as /spaces and /buy.
async function loadCatalog(): Promise<{
  plans: PricingItem[]
  passes: PricingItem[]
  bookings: PricingItem[]
}> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const [{ data: plans }, { data: passes }, { data: resources }] =
    await Promise.all([
      supabase
        .from('plans')
        .select(
          'id, name, description, price_cents, discounted_price_cents, discount_expires_at, features, is_specialized'
        )
        .eq('is_active', true)
        .eq('is_private', false)
        .order('display_order', { ascending: true }),
      supabase
        .from('passes')
        .select(
          'id, name, description, price_cents, discounted_price_cents, discount_expires_at, features, is_specialized'
        )
        .eq('is_active', true)
        .eq('is_private', false)
        .order('display_order', { ascending: true }),
      supabase
        .from('resources')
        .select('id, name, description, price_per_hour_cents, capacity')
        .eq('is_bookable', true)
        .neq('admin_only', true)
        .order('display_order', { ascending: true }),
    ])

  return {
    plans: ((plans as CatalogRow[] | null) ?? []).map(toItem),
    passes: ((passes as CatalogRow[] | null) ?? []).map(toItem),
    bookings: (
      (resources as
        | {
            id: string
            name: string
            description: string | null
            price_per_hour_cents: number | null
            capacity: number
          }[]
        | null) ?? []
    ).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? '',
      price: (r.price_per_hour_cents ?? 0) / 100,
      priceSuffix: '/hr',
      features: [`Seats ${r.capacity}`],
      specialized: false,
    })),
  }
}

export default async function PricingPage() {
  const catalog = await loadCatalog()
  return <PricingView {...catalog} />
}
