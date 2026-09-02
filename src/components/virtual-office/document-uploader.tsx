'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Upload,
  FileText,
  RotateCcw,
  AlertCircle,
} from 'lucide-react'
import {
  VO_DOCUMENT_SPECS,
  VO_DOC_ACCEPT_MIME,
  VO_DOC_MAX_BYTES,
  type VODocumentKind,
} from '@/config/virtual-office'

interface UploadedDoc {
  id: string
  kind: VODocumentKind
  status: 'pending' | 'approved' | 'rejected'
  original_filename: string | null
  created_at: string
}

interface Props {
  initial: UploadedDoc[]
  onChange?: (latestByKind: Record<VODocumentKind, UploadedDoc | null>) => void
}

function statusBadge(status: UploadedDoc['status']) {
  switch (status) {
    case 'approved':
      return {
        text: 'Approved',
        className: 'bg-turquoise-100 text-turquoise-800',
      }
    case 'rejected':
      return { text: 'Changes requested', className: 'bg-red-50 text-red-700' }
    default:
      return {
        text: 'Pending review',
        className: 'bg-neutral-100 text-neutral-700',
      }
  }
}

export default function VirtualOfficeDocumentUploader({
  initial,
  onChange,
}: Props) {
  // Pick the most recent doc per kind from initial data.
  const initialMap = {} as Record<VODocumentKind, UploadedDoc | null>
  for (const spec of VO_DOCUMENT_SPECS) {
    initialMap[spec.kind] = initial.find((d) => d.kind === spec.kind) ?? null
  }
  const [byKind, setByKind] =
    useState<Record<VODocumentKind, UploadedDoc | null>>(initialMap)
  const [busyKind, setBusyKind] = useState<VODocumentKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRefs = useRef<Partial<Record<VODocumentKind, HTMLInputElement>>>({})

  useEffect(() => {
    onChange?.(byKind)
  }, [byKind, onChange])

  const handleSelect = async (kind: VODocumentKind, file: File) => {
    setError(null)
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
    setBusyKind(kind)
    try {
      const fd = new FormData()
      fd.append('kind', kind)
      fd.append('file', file)
      const res = await fetch('/api/virtual-office/documents', {
        method: 'POST',
        body: fd,
      })
      const data = (await res.json()) as {
        ok?: boolean
        document?: UploadedDoc
        error?: string
      }
      if (!res.ok || !data.document) {
        setError(data.error ?? 'Upload failed. Try again.')
        return
      }
      setByKind((prev) => ({ ...prev, [kind]: data.document! }))
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusyKind(null)
      const input = fileRefs.current[kind]
      if (input) input.value = ''
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {VO_DOCUMENT_SPECS.map((spec) => {
        const doc = byKind[spec.kind]
        const isBusy = busyKind === spec.kind
        return (
          <div
            key={spec.kind}
            className="border border-neutral-200 rounded-md p-4"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="font-medium text-sm">{spec.label}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {spec.description}
                </p>
              </div>
              {doc && (
                <span
                  className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(doc.status).className}`}
                >
                  {statusBadge(doc.status).text}
                </span>
              )}
            </div>

            {doc ? (
              <div className="flex items-center gap-2 text-sm text-neutral-700 mt-2">
                <CheckCircle2
                  size={16}
                  className="text-turquoise-600 shrink-0"
                />
                <span className="flex-1 truncate">
                  {doc.original_filename ?? 'Uploaded'}
                </span>
                <button
                  type="button"
                  onClick={() => fileRefs.current[spec.kind]?.click()}
                  className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900 underline"
                  disabled={isBusy}
                >
                  <RotateCcw size={12} />
                  Replace
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRefs.current[spec.kind]?.click()}
                disabled={isBusy}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-neutral-300 rounded-md hover:bg-neutral-50 disabled:opacity-60"
              >
                {isBusy ? (
                  <>Uploading…</>
                ) : (
                  <>
                    <Upload size={14} />
                    Upload file
                  </>
                )}
              </button>
            )}

            <input
              ref={(el) => {
                if (el) fileRefs.current[spec.kind] = el
              }}
              type="file"
              accept={VO_DOC_ACCEPT_MIME.join(',')}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleSelect(spec.kind, f)
              }}
            />

            {doc?.status === 'rejected' && (
              <p className="text-xs text-red-700 mt-2">
                We asked for a clearer or updated version of this document.
                Please upload again.
              </p>
            )}
          </div>
        )
      })}
      <p className="text-xs text-neutral-500 flex items-center gap-1.5">
        <FileText size={12} />
        Stored privately. Used only to verify your Virtual Office sign-up.
      </p>
    </div>
  )
}
