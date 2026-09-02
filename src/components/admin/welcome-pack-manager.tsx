'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileUp, Trash2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  createWelcomePackUploadUrl,
  registerWelcomePackFile,
  deleteWelcomePackFile,
  sendWelcomePack,
} from '@/app/admin/welcome-pack/actions'

export interface WelcomePackFileRow {
  id: string
  label: string
  mimeType: string | null
  sizeBytes: number | null
  createdAt: string
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function WelcomePackManager({
  files,
}: {
  files: WelcomePackFileRow[]
}) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [recipient, setRecipient] = useState('')
  const [intro, setIntro] = useState('')
  const [isPending, startTransition] = useTransition()

  const upload = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const urlRes = await createWelcomePackUploadUrl({ filename: file.name })
      if (!urlRes.ok) throw new Error(urlRes.error)
      const put = await fetch(urlRes.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!put.ok) throw new Error('Upload failed — try again')
      const reg = await registerWelcomePackFile({
        path: urlRes.path,
        label: file.name,
        mimeType: file.type || null,
        sizeBytes: file.size,
      })
      if (!reg.ok) throw new Error(reg.error)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <section className="bg-white border border-neutral-200 rounded-lg p-6">
        <h2 className="font-heading text-lg mb-1">Files</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Documents, pictures, and videos that make up the welcome pack. Members
          get 7-day download links by email.
        </p>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <FileUp size={15} className="mr-1" />
          {uploading ? 'Uploading…' : 'Upload a file'}
        </Button>

        {files.length > 0 && (
          <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
            {files.map((f) => (
              <li
                key={f.id}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">
                    {f.label}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {f.mimeType ?? 'file'}
                    {f.sizeBytes ? ` · ${fmtSize(f.sizeBytes)}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await deleteWelcomePackFile({ fileId: f.id })
                      if (!r.ok) setError(r.error)
                      else router.refresh()
                    })
                  }
                  disabled={isPending}
                  className="p-1.5 text-neutral-400 hover:text-red-700 shrink-0"
                  aria-label={`Delete ${f.label}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-6">
        <h2 className="font-heading text-lg mb-1">Email it out</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Send the pack to one member, or leave blank to send it to everyone.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
              Member email (blank = all members)
            </label>
            <Input
              type="email"
              placeholder="member@example.com"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
              Intro message (optional)
            </label>
            <Textarea
              rows={3}
              placeholder="A short welcome note above the download links"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              disabled={isPending}
              maxLength={3000}
            />
          </div>
          <Button
            type="button"
            disabled={isPending || files.length === 0}
            onClick={() => {
              setError(null)
              setNotice(null)
              startTransition(async () => {
                const r = await sendWelcomePack({
                  recipientEmail: recipient.trim(),
                  intro,
                })
                if (!r.ok) {
                  setError(r.error)
                  return
                }
                setNotice(
                  `Sent to ${r.sent} member${r.sent === 1 ? '' : 's'}${
                    r.skipped > 0 ? ` · ${r.skipped} skipped` : ''
                  }${r.failed > 0 ? ` · ${r.failed} failed` : ''}`
                )
              })
            }}
          >
            <Send size={15} className="mr-1" />
            {isPending ? 'Sending…' : 'Send welcome pack'}
          </Button>
          {notice && <p className="text-sm text-green-800">{notice}</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </section>
    </div>
  )
}
