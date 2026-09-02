import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import MemberPhoneCheckin from '@/components/checkin/member-phone-checkin'
import GuestPhoneCheckin from '@/components/checkin/guest-phone-checkin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Check in | Pinnacle Fitness',
  robots: { index: false, follow: false },
}

// Phone entry point. This is the URL the kiosk QR encodes. A visitor
// scans, lands here, and we route them based on whether they're signed
// in: members get a one-tap check-in, everyone else goes through the
// same Member/Guest wizard as the iPad — minus the kiosk gate.
export default async function CheckinStartPage() {
  const user = await getCurrentUser()

  if (user) {
    // Fresh signups arriving from the QR flow haven't accepted terms yet
    // — send them through onboarding first (name + T&Cs + welcome email
    // + Explore Pass), then bounce back here for the one-tap check-in.
    if (!user.termsAcceptedAt) {
      redirect('/welcome?next=/checkin/start')
    }
    const firstName = (user.fullName ?? user.email).split(/[\s@]/)[0] ?? ''
    return (
      <div className="max-w-md mx-auto">
        <MemberPhoneCheckin
          firstName={firstName}
          fullName={user.fullName ?? ''}
          email={user.email}
        />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <GuestPhoneCheckin />

      <div className="mt-8 border-t border-neutral-200 pt-6 text-center">
        <p className="text-sm font-medium text-neutral-800 mb-1">
          Member, or want to become one?
        </p>
        <p className="text-xs text-neutral-500 mb-4">
          Sign in for one-tap check-in — or create a free account and
          you&apos;re a member from today.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/sign-in?next=/checkin/start"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium border border-neutral-300 rounded-md hover:bg-neutral-50"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up?next=/checkin/start"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium bg-turquoise-500 hover:bg-turquoise-600 text-white rounded-md transition"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  )
}
