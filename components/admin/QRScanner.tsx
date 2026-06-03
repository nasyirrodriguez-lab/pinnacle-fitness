'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onScan: (code: string) => void
  active: boolean
}

export default function QRScanner({ onScan, active }: Props) {
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)
  const scannerRef = useRef<{ clear: () => Promise<void> } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!active) return

    let cancelled = false

    async function startScanner() {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode')

        if (cancelled || !containerRef.current) return

        const scanner = new Html5QrcodeScanner(
          'qr-reader',
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
          },
          false
        )

        scanner.render(
          (decodedText: string) => {
            if (!cancelled) onScan(decodedText)
          },
          () => { /* ignore scan errors */ }
        )

        scannerRef.current = scanner
        setStarted(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Camera unavailable')
      }
    }

    if (!mountedRef.current) {
      mountedRef.current = true
      startScanner()
    }

    return () => {
      cancelled = true
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {})
        scannerRef.current = null
        mountedRef.current = false
      }
    }
  }, [active, onScan])

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        Camera error: {error}
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      <div id="qr-reader" className="overflow-hidden rounded-xl [&_video]:rounded-lg [&_select]:bg-zinc-800 [&_select]:text-zinc-300 [&_select]:border-zinc-700 [&_button]:bg-orange-500 [&_button]:text-white [&_button]:rounded-lg [&_button]:border-0 [&_button]:px-4 [&_button]:py-1.5 [&_button]:text-sm [&_button]:font-semibold" />
      {!started && (
        <p className="text-xs text-zinc-500 mt-2 text-center">Requesting camera access…</p>
      )}
    </div>
  )
}
