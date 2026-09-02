import KioskGate from '@/components/checkin/kiosk-gate'
import GroupCheckinClient from '@/components/checkin/group-checkin-client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Group check-in | The Worx',
  robots: { index: false, follow: false },
}

export default function CheckinGroupPage() {
  return (
    <KioskGate>
      <div className="max-w-2xl mx-auto">
        <GroupCheckinClient />
      </div>
    </KioskGate>
  )
}
