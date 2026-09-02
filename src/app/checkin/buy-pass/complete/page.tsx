import Link from 'next/link'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ paymentId?: string }>
}

export default async function KioskBuyPassCompletePage({
  searchParams,
}: PageProps) {
  const { paymentId } = await searchParams
  if (!paymentId) {
    return (
      <Wrap>
        <AlertCircle size={48} className="text-red-500 mb-3" />
        <h1 className="font-heading text-xl mb-2">Missing payment</h1>
        <Link href="/checkin" className="text-sm underline">
          Back to check-in
        </Link>
      </Wrap>
    )
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('payments')
    .select('status, user_id')
    .eq('id', paymentId)
    .maybeSingle()
  const row = data as { status: string; user_id: string | null } | null

  if (!row) {
    return (
      <Wrap>
        <AlertCircle size={48} className="text-red-500 mb-3" />
        <h1 className="font-heading text-xl mb-2">Payment not found</h1>
        <Link href="/checkin" className="text-sm underline">
          Back to check-in
        </Link>
      </Wrap>
    )
  }

  if (row.status === 'succeeded') {
    return (
      <Wrap>
        <CheckCircle2 size={56} className="text-turquoise-500 mb-3" />
        <h1 className="font-heading text-2xl mb-2">Pass purchased</h1>
        <p className="text-sm text-neutral-600 mb-4">
          Tap below to check in with your new pass.
        </p>
        <Link
          href="/checkin/member"
          className="inline-flex items-center justify-center px-4 py-2 bg-turquoise-500 hover:bg-turquoise-600 text-white text-sm font-medium rounded-md"
        >
          Continue check-in
        </Link>
      </Wrap>
    )
  }

  return (
    <Wrap>
      <AlertCircle size={48} className="text-orange-500 mb-3" />
      <h1 className="font-heading text-xl mb-2">
        Payment is still {row.status}
      </h1>
      <p className="text-sm text-neutral-600 mb-4">
        Give it a moment then continue — the manager can also help.
      </p>
      <Link
        href="/checkin"
        className="inline-flex items-center justify-center px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-900 text-sm font-medium rounded-md"
      >
        Back to check-in
      </Link>
    </Wrap>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-10 flex flex-col items-center text-center">
      {children}
    </div>
  )
}
