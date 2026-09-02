import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { loadDesignationRoles } from '@/lib/members/designations'
import DesignationManager, {
  type RoleWithMembers,
} from '@/components/admin/designation-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Team — Admin',
}

async function loadRolesWithMembers(): Promise<RoleWithMembers[]> {
  const admin = createAdminClient()
  const [roles, { data: people }] = await Promise.all([
    loadDesignationRoles(admin),
    admin
      .from('profiles')
      .select('id, full_name, email, designation')
      .not('designation', 'is', null)
      .order('full_name', { ascending: true }),
  ])

  const byRole = new Map<string, RoleWithMembers['members']>()
  for (const raw of (people as Record<string, unknown>[] | null) ?? []) {
    const roleId = raw.designation as string
    const list = byRole.get(roleId) ?? []
    list.push({
      id: raw.id as string,
      name: (raw.full_name as string | null)?.trim() || (raw.email as string),
      email: raw.email as string,
    })
    byRole.set(roleId, list)
  }

  return roles.map((r) => ({
    id: r.id,
    label: r.label,
    members: byRole.get(r.id) ?? [],
  }))
}

export default async function AdminDesignationsPage() {
  const roles = await loadRolesWithMembers()

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
        <h1 className="font-heading text-3xl mb-1">Team</h1>
        <p className="text-neutral-600 max-w-xl">
          Coaches, front desk and owners. Anyone on the team scans in free and
          never counts against the floor cap. Someone not listed yet? Create
          their account via{' '}
          <Link
            href="/admin/members/new"
            className="text-darkBlue-900 underline"
          >
            Add member
          </Link>{' '}
          and pick their role there.
        </p>
      </div>

      <DesignationManager roles={roles} />
    </div>
  )
}
