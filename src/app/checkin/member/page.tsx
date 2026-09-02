import KioskGate from '@/components/checkin/kiosk-gate'
import MemberCheckinClient from '@/components/checkin/member-checkin-client'

export const dynamic = 'force-dynamic'

export default function MemberCheckinPage() {
  return (
    <KioskGate>
      <div className="max-w-2xl mx-auto">
        <MemberCheckinClient />
      </div>
    </KioskGate>
  )
}
