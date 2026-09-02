'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Camera, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SelfieCapture from '@/components/selfie-capture/selfie-capture'

interface Props {
  currentPhotoUrl: string | null
}

// Update the profile photo used at the front desk. Reuses the
// onboarding selfie endpoint, so the new shot replaces the old one
// everywhere immediately.
export default function ProfilePhotoCard({ currentPhotoUrl }: Props) {
  const router = useRouter()
  const [retaking, setRetaking] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const upload = (blob: Blob) => {
    setError(null)
    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.append('selfie', blob, 'selfie.jpg')
        const res = await fetch('/api/profile/selfie', {
          method: 'POST',
          body: fd,
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          setError(data.error ?? 'Could not save your photo. Try again.')
          return
        }
        setSaved(true)
        setRetaking(false)
        router.refresh()
      } catch {
        setError('Network error. Try again.')
      }
    })
  }

  if (retaking) {
    return (
      <div className="space-y-3">
        <SelfieCapture
          busy={isPending}
          onCapture={upload}
          confirmLabel="Save new photo"
        />
        {error && <p className="text-xs text-red-700">{error}</p>}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setRetaking(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      {currentPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentPhotoUrl}
          alt="Your profile photo"
          className="w-20 h-20 rounded-full object-cover border border-neutral-200 shrink-0"
        />
      ) : (
        <div className="w-20 h-20 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 shrink-0">
          <Camera size={26} />
        </div>
      )}
      <div className="min-w-0">
        {saved && (
          <p className="inline-flex items-center gap-1.5 text-sm text-turquoise-700 mb-1">
            <CheckCircle2 size={15} />
            Photo updated.
          </p>
        )}
        <p className="text-xs text-neutral-500 mb-2">
          The team sees this at check-in. Stays private — never shown publicly.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => setRetaking(true)}
          >
            <Camera size={14} className="mr-1.5" />
            {currentPhotoUrl ? 'Take a new photo' : 'Take a photo'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} className="mr-1.5" />
            {isPending ? 'Uploading…' : 'Upload a photo'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              if (file.size > 8 * 1024 * 1024) {
                setError('That photo is over 8 MB — pick a smaller one.')
                return
              }
              upload(file)
            }}
          />
        </div>
        {error && !retaking && (
          <p className="text-xs text-red-700 mt-1.5">{error}</p>
        )}
      </div>
    </div>
  )
}
