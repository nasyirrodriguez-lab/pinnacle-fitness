'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, RotateCcw, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  // Called with a JPEG Blob after the user confirms the photo.
  onCapture: (blob: Blob) => void | Promise<void>
  // Optional pending/busy state from the parent (e.g. uploading).
  busy?: boolean
  // Optional override label for the final accept button.
  confirmLabel?: string
}

type View =
  | { kind: 'requesting' }
  | { kind: 'denied'; message: string }
  | { kind: 'ready' }
  | { kind: 'preview'; dataUrl: string; blob: Blob }

// Target dimensions for the captured photo. We downscale to keep uploads
// cheap and consistent regardless of the camera resolution.
const TARGET_SIZE = 720
const JPEG_QUALITY = 0.78

export default function SelfieCapture({
  onCapture,
  busy = false,
  confirmLabel = 'Looks good',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [view, setView] = useState<View>({ kind: 'requesting' })

  useEffect(() => {
    let cancelled = false
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          // Force iOS Safari to actually start the stream.
          videoRef.current.playsInline = true
          await videoRef.current.play().catch(() => {})
        }
        setView({ kind: 'ready' })
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Camera permission was blocked. Allow camera access in your browser settings.'
            : 'Could not start the camera. Make sure no other app is using it and try again.'
        setView({ kind: 'denied', message })
      }
    }
    void start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const capture = () => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    // Center-crop the video frame into a square, then scale to TARGET_SIZE.
    const vw = video.videoWidth
    const vh = video.videoHeight
    const side = Math.min(vw, vh)
    const sx = (vw - side) / 2
    const sy = (vh - side) / 2

    const canvas = document.createElement('canvas')
    canvas.width = TARGET_SIZE
    canvas.height = TARGET_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Mirror horizontally so the captured image matches the preview the user
    // saw (the live <video> is mirrored via CSS).
    ctx.translate(TARGET_SIZE, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const reader = new FileReader()
        reader.onload = () => {
          setView({
            kind: 'preview',
            dataUrl: typeof reader.result === 'string' ? reader.result : '',
            blob,
          })
        }
        reader.readAsDataURL(blob)
      },
      'image/jpeg',
      JPEG_QUALITY
    )
  }

  const retake = () => {
    setView({ kind: 'ready' })
  }

  const confirm = async () => {
    if (view.kind !== 'preview') return
    await onCapture(view.blob)
  }

  if (view.kind === 'denied') {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <AlertCircle size={36} className="text-red-500" />
        <p className="font-medium">Camera unavailable</p>
        <p className="text-sm text-neutral-600 max-w-xs">{view.message}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-72 h-72 md:w-80 md:h-80 rounded-full overflow-hidden bg-neutral-900 ring-4 ring-white shadow-lg">
        {view.kind === 'preview' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={view.dataUrl}
            alt="Your selfie preview"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}
        {/* Soft inner ring to guide head placement */}
        {view.kind !== 'preview' && (
          <div
            className="pointer-events-none absolute inset-4 rounded-full border-2 border-white/60"
            aria-hidden
          />
        )}
      </div>

      {view.kind === 'preview' ? (
        <div className="flex flex-wrap items-center justify-center gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={retake}
            disabled={busy}
          >
            <RotateCcw size={16} className="mr-2" />
            Retake
          </Button>
          <Button type="button" onClick={confirm} disabled={busy}>
            <Check size={16} className="mr-2" />
            {busy ? 'Saving…' : confirmLabel}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          onClick={capture}
          disabled={view.kind !== 'ready'}
        >
          <Camera size={18} className="mr-2" />
          {view.kind === 'ready' ? 'Take photo' : 'Starting camera…'}
        </Button>
      )}
      <p className="text-xs text-neutral-500 text-center max-w-xs">
        Center your face in the circle. We use this to recognize you at the
        door.
      </p>
    </div>
  )
}
