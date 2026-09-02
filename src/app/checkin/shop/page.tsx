import KioskGate from '@/components/checkin/kiosk-gate'
import ShopClient from '@/components/checkin/shop-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Shop — Pinnacle' }

export default function KioskShopPage() {
  return (
    <KioskGate>
      <ShopClient />
    </KioskGate>
  )
}
