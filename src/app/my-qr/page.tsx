import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCheckinToken } from '@/lib/checkin/qr'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My check-in QR | The Worx',
  robots: { index: false, follow: false },
}

export default async function MyQrPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in?next=/my-qr')

  const token = issueCheckinToken(user.id)
  const svg = await QRCode.toString(token, {
    type: 'svg',
    margin: 1,
    width: 320,
    errorCorrectionLevel: 'M',
    color: { dark: '#0a1620', light: '#ffffff' },
  })

  return (
    <div className="min-h-[calc(100vh-200px)] bg-neutral-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-neutral-200 rounded-lg p-6 md:p-8 max-w-md w-full text-center">
        <p className="text-xs uppercase tracking-wide text-turquoise-700 font-medium mb-2">
          Check-in
        </p>
        <h1 className="font-heading text-2xl mb-2">
          Show this at the front desk
        </h1>
        <p className="text-sm text-neutral-600 mb-6">
          {user.fullName || user.email}
        </p>

        <div
          className="mx-auto mb-6 w-[260px] h-[260px] flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <p className="text-xs text-neutral-500 mb-4">
          This code rotates every 24 hours for your security. If the front desk
          can&apos;t scan it, just refresh this page.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )
}
