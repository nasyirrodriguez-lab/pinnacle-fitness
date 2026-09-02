'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { adminCheckOutVisit } from '@/app/admin/checkin/actions'

// Small check-out button for the admin visits page ("Currently here"
// rows). The action revalidates the page; router.refresh() pulls the
// updated list without a manual reload.
export default function AdminCheckoutVisitButton({
  visitId,
}: {
  visitId: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const run = () => {
    setError(null)
    startTransition(async () => {
      const result = await adminCheckOutVisit(visitId)
      if (!result.ok && result.error !== 'Already checked out') {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-red-700">{error}</span>}
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-neutral-200 rounded-md text-neutral-600 hover:text-neutral-900 hover:border-neutral-400 disabled:opacity-50"
      >
        <LogOut size={12} />
        {isPending ? 'Checking out…' : 'Check out'}
      </button>
    </span>
  )
}
