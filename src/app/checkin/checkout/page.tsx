import KioskGate from '@/components/checkin/kiosk-gate'
import CheckoutClient from '@/components/checkin/checkout-client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Check out | Pinnacle Fitness',
  robots: { index: false, follow: false },
}

export default function CheckinCheckoutPage() {
  return (
    <KioskGate>
      <div className="max-w-2xl mx-auto">
        <CheckoutClient />
      </div>
    </KioskGate>
  )
}
