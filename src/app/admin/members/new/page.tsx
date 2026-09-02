import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import AdminCreateMemberForm from '@/components/admin/admin-create-member-form'
import { createAdminClient } from '@/utils/supabase/admin'
import { loadDesignationRoles } from '@/lib/members/designations'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Add member — Admin',
}

export default async function AdminNewMemberPage() {
  const roles = await loadDesignationRoles(createAdminClient())
  return (
    <div>
      <Link
        href="/admin/members"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ChevronLeft size={16} />
        All members
      </Link>

      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Add a member</h1>
        <p className="text-neutral-600 max-w-lg">
          Create an account on someone&apos;s behalf — walk-ins, phone sign-ups,
          or anyone who needs a hand getting started.
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6 max-w-xl">
        <AdminCreateMemberForm designationOptions={roles} />
      </div>
    </div>
  )
}
