import KioskGate from '@/components/checkin/kiosk-gate'
import KioskSignupClient from '@/components/checkin/kiosk-signup-client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Become a member | The Worx',
  robots: { index: false, follow: false },
}

export default function CheckinSignupPage() {
  return (
    <KioskGate>
      <div className="max-w-2xl mx-auto">
        <KioskSignupClient />
      </div>
    </KioskGate>
  )
}
