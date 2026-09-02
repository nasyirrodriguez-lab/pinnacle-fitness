'use client'

import { useState, useTransition } from 'react'
import { Upload, FileText, AlertCircle, Plus, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VO_DOC_ACCEPT_MIME, VO_DOC_MAX_BYTES } from '@/config/virtual-office'

export interface ExtraDocRow {
  id: string
  label: string | null
  status: 'pending' | 'approved' | 'rejected'
  original_filename: string | null
  uploaded_by_admin: boolean
  created_at: string
  signed_url: string | null
}

interface Props {
  initial: ExtraDocRow[]
  // Admin uploading on behalf of a member passes targetUserId; member
  // uploading for themselves leaves it undefined.
  targetUserId?: string
  // Lets the admin variant default new docs to "approved" visually.
  variant: 'member' | 'admin'
}

export default function VoExtraDocuments({
  initial,
  targetUserId,
  variant,
}: Props) {
  const [docs, setDocs] = useState<ExtraDocRow[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onUpload = (file: File | null) => {
    if (!file) return
    setError(null)
    if (file.size === 0) {
      setError('That file is empty.')
      return
    }
    if (file.size > VO_DOC_MAX_BYTES) {
      setError(
        `File too large. Max ${Math.round(VO_DOC_MAX_BYTES / (1024 * 1024))} MB.`
      )
      return
    }
    if (!VO_DOC_ACCEPT_MIME.includes(file.type)) {
      setError('Unsupported file type. Use JPG, PNG, HEIC, WEBP, or PDF.')
      return
    }
    if (!label.trim()) {
      setError('Add a short label first (e.g. “Letter from accountant”).')
      return
    }

    const form = new FormData()
    form.append('kind', 'other')
    form.append('label', label.trim())
    form.append('file', file)
    if (targetUserId) form.append('targetUserId', targetUserId)

    startTransition(async () => {
      try {
        const res = await fetch('/api/virtual-office/documents', {
          method: 'POST',
          body: form,
        })
        const data = (await res.json()) as {
          ok?: boolean
          error?: string
          document?: {
            id: string
            kind: string
            label: string | null
            status: 'pending' | 'approved' | 'rejected'
            created_at: string
            original_filename: string | null
          }
        }
        if (!res.ok || !data.ok || !data.document) {
          setError(data.error ?? 'Upload failed.')
          return
        }
        setDocs((prev) => [
          {
            id: data.document!.id,
            label: data.document!.label,
            status: data.document!.status,
            original_filename: data.document!.original_filename,
            uploaded_by_admin: variant === 'admin',
            created_at: data.document!.created_at,
            signed_url: null,
          },
          ...prev,
        ])
        setLabel('')
        setShowForm(false)
      } catch {
        setError('Network error. Try again.')
      }
    })
  }

  return (
    <div className="space-y-3">
      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 border border-neutral-200 rounded-md p-3 text-sm"
            >
              <FileText size={18} className="text-neutral-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{d.label ?? 'Document'}</p>
                <p className="text-xs text-neutral-500 truncate">
                  {d.original_filename ?? '—'}
                  {d.uploaded_by_admin && ' · uploaded by admin'}
                </p>
              </div>
              {d.signed_url && (
                <a
                  href={d.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-darkBlue-900 hover:underline"
                >
                  View
                </a>
              )}
              <span
                className={
                  d.status === 'approved'
                    ? 'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-turquoise-100 text-turquoise-800'
                    : d.status === 'rejected'
                      ? 'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700'
                      : 'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700'
                }
              >
                {d.status === 'approved'
                  ? 'Approved'
                  : d.status === 'rejected'
                    ? 'Rejected'
                    : 'Pending'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="border border-neutral-200 rounded-md p-3 space-y-3">
          <div>
            <Label htmlFor="extra-label">Label</Label>
            <Input
              id="extra-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Letter from accountant"
              maxLength={120}
            />
          </div>
          <div>
            <Label
              htmlFor="extra-file"
              className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-darkBlue-900 hover:underline"
            >
              <Upload size={14} />
              {isPending ? 'Uploading…' : 'Choose file to upload'}
            </Label>
            <input
              id="extra-file"
              type="file"
              accept={VO_DOC_ACCEPT_MIME.join(',')}
              className="sr-only"
              disabled={isPending || !label.trim()}
              onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-neutral-500 mt-1">
              JPG, PNG, HEIC, WEBP, or PDF. Max{' '}
              {Math.round(VO_DOC_MAX_BYTES / (1024 * 1024))} MB.
            </p>
          </div>
          {error && (
            <p className="flex items-start gap-2 text-xs text-red-700">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setShowForm(false)
              setError(null)
              setLabel('')
            }}
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            Cancel
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          disabled={isPending}
        >
          <Plus size={14} className="mr-1.5" />
          {docs.length === 0 ? 'Add a document' : 'Add another document'}
        </Button>
      )}

      {variant === 'admin' && docs.length > 0 && (
        <p className="text-xs text-neutral-500 inline-flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-turquoise-600" />
          Admin uploads are auto-approved.
        </p>
      )}
    </div>
  )
}
