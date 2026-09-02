'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PauseCircle } from 'lucide-react'
import { resolveMemberRequest } from '@/app/admin/notifications/request-actions'
import { fmtAstDateTime } from '@/lib/time/ast'

export interface MemberRequestRow {
  id: string
  kind: string
  note: string | null
  createdAt: string
  memberName: string
  memberId: string
}

const KIND_LABEL: Record<string, string> = {
  pause: 'Pause plan',
  deactivate: 'Deactivate plan',
  reactivate: 'Reactivate plan',
}

export default function AdminMemberRequests({
  requests,
}: {
  requests: MemberRequestRow[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (requests.length === 0) return null

  const resolve = (requestId: string, outcome: 'actioned' | 'dismissed') => {
    setError(null)
    startTransition(async () => {
      const r = await resolveMemberRequest({ requestId, outcome })
      if (!r.ok) {
        setError(r.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="bg-orange-50 border border-orange-200 rounded-lg overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-orange-200 flex items-center gap-2">
        <PauseCircle size={18} className="text-orange-700" />
        <h2 className="font-heading text-lg flex-1">Plan change requests</h2>
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full bg-orange-500 text-white">
          {requests.length} open
        </span>
      </div>
      <ul className="divide-y divide-orange-100">
        {requests.map((r) => (
          <li
            key={r.id}
            className="px-6 py-4 flex items-start justify-between gap-3 flex-wrap"
          >
            <div className="min-w-0">
              <p className="text-sm">
                <Link
                  href={`/admin/members/${r.memberId}`}
                  className="font-medium hover:underline"
                >
                  {r.memberName}
                </Link>{' '}
                · <strong>{KIND_LABEL[r.kind] ?? r.kind}</strong>
              </p>
              {r.note && (
                <p className="text-sm text-neutral-700 mt-1 whitespace-pre-line">
                  {r.note}
                </p>
              )}
              <p className="text-xs text-neutral-500 mt-1">
                {fmtAstDateTime(r.createdAt)}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                disabled={isPending}
                onClick={() => resolve(r.id, 'actioned')}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-50"
              >
                Done — actioned
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => resolve(r.id, 'dismissed')}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 rounded hover:bg-white disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="px-6 pb-4 text-sm text-red-700">{error}</p>}
    </section>
  )
}
