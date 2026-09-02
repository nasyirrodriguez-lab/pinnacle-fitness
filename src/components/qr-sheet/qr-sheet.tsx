'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { QrCode, ScanLine } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useQrSheet } from './qr-sheet-context'

const Scanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then((m) => m.Scanner),
  { ssr: false }
)

type Mode = 'show' | 'scan'

function QrImage({ token }: { token: string }) {
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // Lazy-load qrcode only when actually rendering a code.
      const QRCode = (await import('qrcode')).default
      const out = await QRCode.toString(token, {
        type: 'svg',
        margin: 1,
        width: 320,
        errorCorrectionLevel: 'M',
        color: { dark: '#0a1620', light: '#ffffff' },
      })
      if (!cancelled) setSvg(out)
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  if (!svg) {
    return (
      <div className="w-[260px] h-[260px] rounded-md bg-neutral-100 animate-pulse" />
    )
  }
  return (
    <div
      // The qrcode library renders the SVG at its requested `width` regardless
      // of the wrapping element. The `[&_svg]` selector forces the inline SVG
      // to scale to the box so it never overflows on smaller phone screens.
      className="w-[260px] h-[260px] rounded-md bg-white p-2 shadow-sm overflow-hidden [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode
  onChange: (m: Mode) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="QR code or scanner"
      className="inline-flex p-1 rounded-full bg-neutral-100 mb-6"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'show'}
        onClick={() => onChange('show')}
        className={
          mode === 'show'
            ? 'inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white text-neutral-900 text-sm font-medium shadow-sm'
            : 'inline-flex items-center gap-2 px-5 py-2 rounded-full text-neutral-500 text-sm font-medium'
        }
      >
        <QrCode size={16} />
        My QR
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'scan'}
        onClick={() => onChange('scan')}
        className={
          mode === 'scan'
            ? 'inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white text-neutral-900 text-sm font-medium shadow-sm'
            : 'inline-flex items-center gap-2 px-5 py-2 rounded-full text-neutral-500 text-sm font-medium'
        }
      >
        <ScanLine size={16} />
        Scan
      </button>
    </div>
  )
}

interface ShowProps {
  token: string | null
  loading: boolean
  error: string | null
  fullName: string
}

function ShowMode({ token, loading, error, fullName }: ShowProps) {
  if (loading) {
    return <QrImage token="" />
  }
  if (error || !token) {
    return (
      <p className="text-sm text-red-700">
        {error ?? 'Could not load your QR. Refresh and try again.'}
      </p>
    )
  }
  return (
    <div className="flex flex-col items-center">
      <QrImage token={token} />
      <p className="mt-4 text-base font-medium">{fullName || 'Member'}</p>
      <p className="mt-1 text-xs text-neutral-500">
        Rotates every 24 hours. Show this at the front desk.
      </p>
    </div>
  )
}

function detectIosStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  const isIos = /iPad|iPhone|iPod/.test(nav.userAgent)
  return Boolean(isIos && nav.standalone)
}

function noopSubscribe() {
  return () => {}
}

function ScanMode({ onClose }: { onClose: () => void }) {
  // iOS PWA standalone silently blocks getUserMedia. Detect via
  // useSyncExternalStore so we don't have to call setState inside an
  // effect.
  const iosStandalone = useSyncExternalStore(
    noopSubscribe,
    detectIosStandalone,
    () => false
  )

  if (iosStandalone) {
    return (
      <div className="text-center max-w-xs">
        <ScanLine size={36} className="text-neutral-400 mx-auto mb-3" />
        <p className="font-medium mb-2">Scanner not available here</p>
        <p className="text-sm text-neutral-600 mb-4">
          iOS blocks camera access in installed web apps. Open theworx.io in
          Safari and try again, or use the QR on the kiosk to scan you in.
        </p>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[340px]">
      <div className="aspect-square w-full bg-black rounded-lg overflow-hidden">
        <Scanner
          onScan={(codes) => {
            const raw = codes[0]?.rawValue
            if (!raw) return
            // We don't trust scanned codes server-side from the member side
            // (no kiosk auth). For now we just open the raw value if it's a
            // URL we own; otherwise show it for the member to read.
            try {
              const url = new URL(raw)
              if (url.hostname.endsWith('theworx.io')) {
                window.location.assign(url.toString())
                return
              }
            } catch {
              /* not a URL */
            }
            alert(`Scanned: ${raw}`)
          }}
          onError={() => {
            /* surface nothing — most errors here are camera-busy retries */
          }}
          constraints={{ facingMode: 'environment' }}
          styles={{
            container: { width: '100%', height: '100%' },
            video: { width: '100%', height: '100%', objectFit: 'cover' },
          }}
        />
      </div>
      <p className="mt-3 text-xs text-neutral-500 text-center">
        Point at any QR code from The Worx — passes, events, Wi-Fi.
      </p>
    </div>
  )
}

interface Props {
  fullName: string
}

export default function QrSheet({ fullName }: Props) {
  const { state, closeSheet, setMode } = useQrSheet()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch token whenever the sheet opens. Token is short-lived so this
  // gets a fresh one every session.
  useEffect(() => {
    if (!state.open || state.mode !== 'show') return
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await fetch('/api/auth/qr-token', { cache: 'no-store' })
        if (!res.ok) {
          setError('Sign in again to load your QR.')
          return
        }
        const data = (await res.json()) as { token?: string }
        setToken(data.token ?? null)
      } catch {
        setError('Network error.')
      } finally {
        setLoading(false)
      }
    })()
  }, [state.open, state.mode])

  return (
    <Sheet
      open={state.open}
      onOpenChange={(open) => (open ? null : closeSheet())}
    >
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-4 pb-8 pt-4 h-[min(90vh,640px)]"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <SheetHeader className="text-center">
          <SheetTitle className="sr-only">Check-in QR</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col items-center mt-2">
          <ModeToggle mode={state.mode} onChange={setMode} />
          <div className="flex-1 flex items-center justify-center min-h-[300px]">
            {state.mode === 'show' ? (
              <ShowMode
                token={token}
                loading={loading}
                error={error}
                fullName={fullName}
              />
            ) : (
              <ScanMode onClose={closeSheet} />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
