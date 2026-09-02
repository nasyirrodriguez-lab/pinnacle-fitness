import Link from 'next/link'
import { requireCoach } from '@/lib/auth/require-admin'
import { isOwner } from '@/lib/auth/roles'
import ViewSwitch from '@/components/admin/view-switch'
import CoachNav from '@/components/admin/coach-nav'
import SignOutButton from '@/components/sign-out-button/sign-out-button'

export const dynamic = 'force-dynamic'

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const coach = await requireCoach()
  return (
    <div className="bg-neutral-50 min-h-[calc(100vh-200px)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
          <aside className="md:sticky md:top-8 md:self-start">
            <div className="mb-4 px-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Coach
              </p>
              <p className="text-sm font-medium text-neutral-900 truncate">
                {coach.fullName || coach.email}
              </p>
            </div>
            {isOwner(coach.role) && (
              <div className="mb-4 px-3">
                <ViewSwitch current="coach" />
              </div>
            )}
            <CoachNav />
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
