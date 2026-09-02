import Link from 'next/link'
import Wordmark from '@/components/logo/wordmark'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { loadReceptionStatus } from '@/lib/checkin/reception-status.server'
import {
  ReceptionStatusProvider,
  ReceptionStatusControls,
  ReceptionStatusBanner,
} from '@/components/checkin/reception-status'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Check in | Pinnacle Fitness',
  robots: { index: false, follow: false },
}

// The /checkin tree serves two audiences:
//   - the paired iPad kiosk (Member / Guest / Buy-Pass flows under /checkin/*)
//   - phone visitors who scan the kiosk's QR (/checkin/start, /checkin/me)
// The kiosk pages call assertPairedKiosk() themselves; the phone routes
// stay public. This layout is just the visual shell — header changes
// depending on whether the device cookie is set.
export default async function CheckinLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [device, initialStatus] = await Promise.all([
    getPairedDevice(),
    loadReceptionStatus(),
  ])

  return (
    <ReceptionStatusProvider initial={initialStatus}>
      <div className="min-h-screen bg-ground">
        <header
          className="sticky top-0 z-30 bg-ground border-b border-bronze-line px-6 py-4 flex items-center justify-between text-ice"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <Link href={device ? '/checkin' : '/'}>
            <Wordmark width={120} />
          </Link>
          <div className="flex items-center gap-3">
            {device ? (
              <p className="text-xs text-neutral-500">{device.label}</p>
            ) : (
              <p className="text-xs text-neutral-500">Check in</p>
            )}
            {/* Only the paired kiosk can set the front-desk status; phone
                visitors who scan the QR don't see the control. */}
            {device && <ReceptionStatusControls />}
          </div>
        </header>
        {/* Full-width status banner sits directly under the header so it
            reads as a message board; self check-in continues below it. */}
        <ReceptionStatusBanner />
        <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">{children}</main>
      </div>
    </ReceptionStatusProvider>
  )
}
