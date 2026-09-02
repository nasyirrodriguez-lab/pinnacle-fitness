import KioskGate from '@/components/checkin/kiosk-gate'
import GuestCheckinClient from '@/components/checkin/guest-checkin-client'

export const dynamic = 'force-dynamic'

export default function GuestCheckinPage() {
  return (
    <KioskGate>
      <div className="max-w-2xl mx-auto">
        <GuestCheckinClient />
      </div>
    </KioskGate>
  )
}
