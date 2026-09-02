import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import CheckoutStatusPoller from '@/components/checkout/status-poller'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ paymentId?: string }>
}

export default async function CheckoutCompletePage({
  searchParams,
}: PageProps) {
  const { paymentId } = await searchParams

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-white border border-neutral-200 rounded-lg p-8">
        {paymentId ? (
          <CheckoutStatusPoller paymentId={paymentId} />
        ) : (
          <div className="text-center">
            <AlertTriangle className="mx-auto w-12 h-12 text-orange-500 mb-3" />
            <h1 className="font-heading text-2xl mb-2">Missing payment</h1>
            <p className="text-neutral-600 mb-6">
              We couldn&apos;t find a payment to confirm. Head back to the
              dashboard.
            </p>
            <Link href="/dashboard" className="text-turquoise-700 underline">
              Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
