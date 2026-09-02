import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { loadPtResources } from '@/lib/booking/pt'
import AdminBookingForm from '@/components/admin/admin-booking-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Book someone in — Admin' }

interface PageProps {
  searchParams: Promise<{ user?: string; coach?: string }>
}

export default async function AdminNewBookingPage({ searchParams }: PageProps) {
  const { user, coach } = await searchParams
  const admin = createAdminClient()
  const [{ data: profiles }, resources] = await Promise.all([
    admin.from('profiles').select('id, full_name, email').eq('archived', false).eq('role', 'member').order('full_name').limit(2000),
    loadPtResources(admin),
  ])
  const members = ((profiles as { id: string; full_name: string | null; email: string }[] | null) ?? []).map((p) => ({
    id: p.id,
    label: p.full_name?.trim() ? `${p.full_name.trim()} · ${p.email}` : p.email,
  }))
  const coaches = resources.map((r) => ({ id: r.id, name: r.coach?.displayName ?? r.name, capacity: r.capacity }))

  return (
    <div>
      <Link href="/admin/bookings" className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4">
        <ChevronLeft size={16} /> Sessions
      </Link>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Book someone in</h1>
        <p className="text-neutral-600 max-w-xl">Pick the member, the coach and the hour. Sessions are prepaid — nothing to charge here; the session is spent when they scan in.</p>
      </div>
      <div className="bg-white border border-neutral-200 rounded-lg p-6 max-w-2xl">
        <AdminBookingForm members={members} coaches={coaches} defaultUserId={user} defaultResourceId={coach ? `pt-${coach}` : undefined} />
      </div>
    </div>
  )
}
