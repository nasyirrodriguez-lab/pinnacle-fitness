import Link from 'next/link'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { Users, ArrowRight } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Book a room — The Worx',
  description:
    'Book a meeting room or conference room at The Worx coworking space in Port of Spain.',
}

interface BookableResource {
  id: string
  name: string
  description: string | null
  kind: string
  capacity: number
  price_per_hour_cents: number | null
  currency: string
}

async function loadBookableResources(): Promise<BookableResource[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data, error } = await supabase
    .from('resources')
    .select(
      'id, name, description, kind, capacity, price_per_hour_cents, currency, is_bookable, requires_contact, admin_only'
    )
    .eq('is_bookable', true)
    .neq('requires_contact', true)
    .neq('admin_only', true)
    .order('display_order', { ascending: true })

  if (error || !data) return []
  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    kind: row.kind as string,
    capacity: row.capacity as number,
    price_per_hour_cents: (row.price_per_hour_cents as number | null) ?? null,
    currency: row.currency as string,
  }))
}

function priceLabel(r: BookableResource): string {
  if (r.price_per_hour_cents == null) return '—'
  const dollars = r.price_per_hour_cents / 100
  return `${r.currency} $${dollars.toFixed(0)}/hr`
}

export default async function BookIndexPage() {
  const resources = await loadBookableResources()

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
      <div className="mb-10">
        <p className="text-sm font-medium text-turquoise-700 uppercase tracking-wide mb-2">
          Bookings
        </p>
        <h1 className="font-heading text-4xl md:text-5xl mb-3">Book a room.</h1>
        <p className="text-lg text-neutral-600 max-w-2xl">
          Pick a meeting room or the conference room. Choose your slot — one
          continuous block or several throughout the day.
        </p>
      </div>

      {resources.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center text-neutral-500">
          No rooms available right now. Email{' '}
          <a
            href="mailto:team@theworx.io"
            className="text-turquoise-700 underline"
          >
            team@theworx.io
          </a>
          .
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {resources.map((r) => (
            <li key={r.id}>
              <Link
                href={`/book/${r.id}`}
                className="group flex flex-col h-full bg-white border border-neutral-200 rounded-lg p-6 hover:border-turquoise-500 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="font-heading text-xl">{r.name}</h2>
                  <ArrowRight
                    size={18}
                    className="text-neutral-400 group-hover:text-turquoise-600 group-hover:translate-x-0.5 transition mt-1 shrink-0"
                  />
                </div>

                <p className="font-heading text-2xl text-neutral-900 mb-3">
                  {priceLabel(r)}
                </p>

                <p className="text-sm text-neutral-600 mb-4">
                  {r.description ?? ''}
                </p>

                <div className="mt-auto flex items-center gap-1 text-xs text-neutral-500">
                  <Users size={14} />
                  Up to {r.capacity} {r.capacity === 1 ? 'person' : 'people'}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12 pt-8 border-t border-neutral-200">
        <p className="text-sm text-neutral-600">
          Hosting an event?{' '}
          <a
            href="mailto:team@theworx.io"
            className="text-turquoise-700 underline font-medium"
          >
            Get in touch about our event space
          </a>
          .
        </p>
      </div>
    </div>
  )
}
