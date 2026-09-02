import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Shield } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/current-user'
import { needsOnboarding } from '@/lib/auth/onboarding'
import { createAdminClient } from '@/utils/supabase/admin'
import DashboardNav from '@/components/dashboard-nav/dashboard-nav'
import SignOutButton from '@/components/sign-out-button/sign-out-button'
import MobileBottomNav from '@/components/mobile-bottom-nav/mobile-bottom-nav'
import { QrSheetProvider } from '@/components/qr-sheet/qr-sheet-context'
import QrSheet from '@/components/qr-sheet/qr-sheet'
import InstallPrompt from '@/components/install-prompt/install-prompt'
import { unreadNotificationCount } from '@/lib/notifications/notify'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  if (needsOnboarding(user)) redirect('/welcome?next=/dashboard')

  const unreadMessages = await unreadNotificationCount(
    createAdminClient(),
    user.id
  )
  const isTeam = ['coach', 'owner', 'admin'].includes(user.role)

  const memberName = user.fullName || user.email.split('@')[0] || 'Member'
  const memberEmail = user.email

  return (
    <QrSheetProvider>
      <div className="bg-neutral-50 min-h-[calc(100vh-200px)]">
        <div className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
            <aside className="hidden md:block md:sticky md:top-8 md:self-start">
              <div className="mb-6 px-3">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {memberName}
                </p>
                <p className="text-xs text-neutral-500 truncate">
                  {memberEmail}
                </p>
              </div>
              <DashboardNav unreadMessages={unreadMessages} />
              {isTeam && (
                <Link
                  href="/admin"
                  className="mt-6 mx-3 flex items-center gap-2 px-3 py-2 rounded-md bg-darkBlue-900 text-white text-sm font-medium hover:bg-darkBlue-800 transition-colors"
                >
                  <Shield size={16} />
                  Coach portal
                </Link>
              )}
              <div className="mt-6 px-3">
                <SignOutButton />
              </div>
            </aside>
            <div>{children}</div>
          </div>
        </div>
      </div>
      <MobileBottomNav />
      <QrSheet fullName={memberName} />
      <InstallPrompt />
    </QrSheetProvider>
  )
}
