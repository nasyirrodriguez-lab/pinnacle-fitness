import type { Metadata } from 'next'
import InstallGuide from '@/components/install-prompt/install-guide'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Add Pinnacle Fitness to your home screen | Pinnacle Fitness',
  description:
    'Install Pinnacle Fitness as an app on your phone for one-tap check-in. Step-by-step instructions for iPhone Safari and Android Chrome.',
  robots: { index: false, follow: false },
}

export default function InstallPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
      <div className="mb-8">
        <p className="text-sm font-medium text-turquoise-700 uppercase tracking-wide mb-2">
          Install
        </p>
        <h1 className="font-heading text-3xl md:text-4xl mb-3">
          Add Pinnacle Fitness to your home screen.
        </h1>
        <p className="text-lg text-neutral-600">
          One tap to your QR code, your bookings, and your mail. No download, no
          app store, no account password.
        </p>
      </div>
      <InstallGuide />
    </div>
  )
}
