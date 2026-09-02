import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import InfluencerBatchForm from '@/components/admin/influencer-batch-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Influencer pass batch — Admin',
}

export default function InfluencerBatchPage() {
  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/payments"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ChevronLeft size={16} />
        Payments
      </Link>

      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Influencer pass batch</h1>
        <p className="text-neutral-600">
          Grant a complimentary 5-day pass to a list of invited content
          creators. Each pass costs $0, has 5 uses, and expires on the campaign
          date you choose. The recipients must already have a member profile
          (email match) &mdash; if they don&apos;t we&apos;ll tell you which to
          follow up on.
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <InfluencerBatchForm
          defaultExpiry="2026-06-06"
          defaultNote="Influencer 5-day pass — testimonial + tagged story in exchange"
        />
      </div>
    </div>
  )
}
