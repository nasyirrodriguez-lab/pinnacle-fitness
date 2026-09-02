import KioskGate from '@/components/checkin/kiosk-gate'
import StaffCheckinClient from '@/components/checkin/staff-checkin-client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Staff check-in | Pinnacle Fitness',
  robots: { index: false, follow: false },
}

export default function CheckinStaffPage() {
  return (
    <KioskGate>
      <div className="max-w-2xl mx-auto">
        <StaffCheckinClient />
      </div>
    </KioskGate>
  )
}
