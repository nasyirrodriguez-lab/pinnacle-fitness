'use client'

import { useState, useTransition } from 'react'
import { Check, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminReviewVoDocument } from '@/app/admin/virtual-office/actions'

interface Props {
  documentId: string
  currentStatus: 'pending' | 'approved' | 'rejected'
  signedUrl: string | null
  reviewNote: string | null
}

export default function VoDocumentReviewer({
  documentId,
  currentStatus,
  signedUrl,
  reviewNote,
}: Props) {
  const [note, setNote] = useState(reviewNote ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const submit = (status: 'approved' | 'rejected') => {
    setError(null)
    startTransition(async () => {
      const r = await adminReviewVoDocument({
        documentId,
        status,
        note: note.trim() || undefined,
      })
      if (!r.ok) setError(r.error ?? 'Failed')
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {signedUrl ? (
          <a
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-turquoise-700 hover:text-turquoise-900 underline"
          >
            View file <ExternalLink size={12} />
          </a>
        ) : (
          <span className="text-xs text-neutral-500">File unavailable</span>
        )}
        <span
          className={
            currentStatus === 'approved'
              ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-turquoise-100 text-turquoise-800'
              : currentStatus === 'rejected'
                ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700'
                : 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700'
          }
        >
          {currentStatus === 'pending'
            ? 'Pending review'
            : currentStatus === 'approved'
              ? 'Approved'
              : 'Rejected'}
        </span>
      </div>
      <Input
        placeholder="Optional review note (shown to member if rejected)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={isPending}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => submit('approved')}
        >
          <Check size={14} className="mr-1" />
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => submit('rejected')}
        >
          <X size={14} className="mr-1" />
          Reject
        </Button>
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    </div>
  )
}
