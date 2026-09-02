import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import AdminNav from '@/components/admin/admin-nav'
import SignOutButton from '@/components/sign-out-button/sign-out-button'
import ViewSwitch from '@/components/admin/view-switch'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const owner = await requireAdmin()
  const ownerName = owner.fullName || owner.email.split('@')[0]

  return (
    <div className="bg-neutral-50 min-h-[calc(100vh-200px)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
          <aside className="md:sticky md:top-8 md:self-start">
            <div className="mb-4 px-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Business
              </p>
              <p className="text-sm font-medium text-neutral-900 truncate">
                {ownerName}
              </p>
              <p className="text-xs text-neutral-500 truncate">{owner.email}</p>
            </div>
            {owner.coachId && (
              <div className="mb-4 px-3">
                <ViewSwitch current="business" />
              </div>
            )}
            <AdminNav />
            <div className="mt-6 px-3 space-y-2">
              <Link
                href="/dashboard"
                className="block text-xs text-neutral-500 hover:text-neutral-900"
              >
                ← Member view
              </Link>
              <SignOutButton />
            </div>
          </aside>
          <div>{children}</div>
        </div>
      </div>
    </div>
  )
}
