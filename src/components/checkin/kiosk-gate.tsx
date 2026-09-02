import Link from 'next/link'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'

// Server component. Renders children only when the request has a valid
// paired-device cookie; otherwise renders a notice telling the admin to
// pair the device first. Used by each iPad kiosk page so that public
// phone-entry pages under /checkin/* can stay un-gated.
export default async function KioskGate({
  children,
}: {
  children: React.ReactNode
}) {
  const device = await getPairedDevice()
  if (!device) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-8 max-w-md mx-auto text-center">
        <h1 className="font-heading text-2xl mb-3">
          This tablet isn&apos;t paired
        </h1>
        <p className="text-sm text-neutral-600 mb-4">
          Ask an admin to sign in and pair this device from{' '}
          <Link href="/admin/checkin" className="underline">
            /admin/checkin
          </Link>
          .
        </p>
      </div>
    )
  }
  return <>{children}</>
}
