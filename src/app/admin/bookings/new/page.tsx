import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import AdminBookingForm from '@/components/admin/admin-booking-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Book on behalf — Admin',
}

interface MemberOption {
  id: string
  label: string
  fullName: string
  email: string
}

interface ResourceOption {
  id: string
  name: string
  description: string | null
  kind: string
  capacity: number
  pricePerHourCents: number
  afterHoursPricePerHourCents: number | null
  afterHoursStartsAtHour: number | null
  adminOnly: boolean
  currency: string
  openHour: number
  closeHour: number
  slotMinutes: number
}

async function loadOptions(): Promise<{
  members: MemberOption[]
  resources: ResourceOption[]
}> {
  const admin = createAdminClient()
  const [{ data: profilesData }, { data: resourcesData }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, email')
      .eq('archived', false)
      .order('full_name', { ascending: true })
      .limit(2000),
    admin
      .from('resources')
      .select(
        'id, name, description, kind, capacity, price_per_hour_cents, after_hours_price_per_hour_cents, after_hours_starts_at_hour, admin_only, currency, open_hour, close_hour, slot_minutes, is_bookable, requires_contact, display_order'
      )
      .order('display_order', { ascending: true }),
  ])

  const members: MemberOption[] = (
    (profilesData as Array<{
      id: string
      full_name: string | null
      email: string
    }> | null) ?? []
  ).map((p) => ({
    id: p.id,
    fullName: p.full_name ?? '',
    email: p.email,
    label: p.full_name ? `${p.full_name} · ${p.email}` : p.email,
  }))

  const resources: ResourceOption[] = (
    (resourcesData as Array<{
      id: string
      name: string
      description: string | null
      kind: string
      capacity: number
      price_per_hour_cents: number | null
      after_hours_price_per_hour_cents: number | null
      after_hours_starts_at_hour: number | null
      admin_only: boolean | null
      currency: string
      open_hour: number
      close_hour: number
      slot_minutes: number
      is_bookable: boolean
    }> | null) ?? []
  ).map((r) => ({
    id: r.id,
    // Spaces the public site doesn't sell are still admin-bookable for
    // events — flag them so the picker reads honestly.
    name: r.is_bookable ? r.name : `${r.name} · events (admin only)`,
    description: r.description,
    kind: r.kind,
    capacity: r.capacity,
    pricePerHourCents: r.price_per_hour_cents ?? 0,
    afterHoursPricePerHourCents: r.after_hours_price_per_hour_cents ?? null,
    afterHoursStartsAtHour: r.after_hours_starts_at_hour ?? null,
    adminOnly: Boolean(r.admin_only),
    currency: r.currency,
    openHour: r.open_hour,
    // Admins can run bookings and events later than the public window.
    closeHour: Math.max(r.close_hour, 21),
    slotMinutes: r.slot_minutes,
  }))

  return { members, resources }
}

interface PageProps {
  searchParams: Promise<{ user?: string; resource?: string }>
}

export default async function NewBookingPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const { members, resources } = await loadOptions()

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ChevronLeft size={16} />
        Bookings
      </Link>

      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Book a meeting space</h1>
        <p className="text-neutral-600">
          On behalf of a member, or for a guest who isn&apos;t on the platform.
          Bookings are saved as confirmed; you can optionally record the payment
          at the same time.
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <AdminBookingForm
          members={members}
          resources={resources}
          defaultUserId={sp.user}
          defaultResourceId={sp.resource}
        />
      </div>
    </div>
  )
}
