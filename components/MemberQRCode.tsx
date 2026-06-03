'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

export default function MemberQRCode({ memberId }: { memberId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, memberId, {
        width: 180,
        margin: 2,
        color: {
          dark: '#ffffff',
          light: '#18181b',
        },
      })
    }
  }, [memberId])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 bg-zinc-800 rounded-xl border border-zinc-700">
        <canvas ref={canvasRef} className="rounded-lg" />
      </div>
      <p className="text-xs text-zinc-500 font-mono tracking-widest">{memberId}</p>
    </div>
  )
}
