import KioskGate from '@/components/checkin/kiosk-gate'
import BookingArrivalsClient from '@/components/checkin/booking-arrivals-client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Booking check-in | The Worx',
  robots: { index: false, follow: false },
}

export default function CheckinBookingPage() {
  return (
    <KioskGate>
      <div className="max-w-2xl mx-auto">
        <BookingArrivalsClient />
      </div>
    </KioskGate>
  )
}
