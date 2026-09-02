import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import ResourceEditForm from '@/components/admin/resource-edit-form'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

async function loadResource(id: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('resources')
    .select(
      'id, name, description, kind, capacity, price_per_hour_cents, currency, open_hour, close_hour, slot_minutes, is_bookable, requires_contact'
    )
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  const row = data as Record<string, unknown>
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? '',
    kind: row.kind as string,
    capacity: row.capacity as number,
    pricePerHourCents: (row.price_per_hour_cents as number | null) ?? null,
    currency: row.currency as string,
    openHour: row.open_hour as number,
    closeHour: row.close_hour as number,
    slotMinutes: row.slot_minutes as number,
    isBookable: (row.is_bookable as boolean) ?? false,
    requiresContact: (row.requires_contact as boolean) ?? false,
  }
}

export default async function AdminResourceEditPage({ params }: PageProps) {
  const { id } = await params
  const resource = await loadResource(id)
  if (!resource) notFound()

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
          Edit resource
        </p>
        <h1 className="font-heading text-3xl mb-1">{resource.name}</h1>
        <p className="text-sm text-neutral-500">
          ID: <span className="font-mono">{resource.id}</span> · Kind:{' '}
          {resource.kind}
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6 max-w-2xl">
        <ResourceEditForm resource={resource} />
      </div>
    </div>
  )
}
