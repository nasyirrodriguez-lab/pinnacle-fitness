import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import IssueCreditsForm from '@/components/admin/issue-credits-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Issue credits — Admin',
}

// Default to 3 months from now for the expiry, matching the policy.
function defaultExpiryIso(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  return d.toISOString().slice(0, 10)
}

export default function IssueCreditsPage() {
  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/credits"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ChevronLeft size={16} />
        Credits
      </Link>

      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Issue account credits</h1>
        <p className="text-neutral-600">
          Paste a list to credit members&apos; accounts in TTD. One line per
          recipient: <code>email, amount, optional note</code>. Members already
          on the platform are credited immediately. Anyone not yet signed up
          gets an unclaimed grant that auto-attaches when they first create
          their account.
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <IssueCreditsForm
          defaultExpiry={defaultExpiryIso()}
          defaultReason="closure_compensation"
        />
      </div>
    </div>
  )
}
