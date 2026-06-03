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
          dark: '#1C1A17',
          light: '#ffffff',
        },
      })
    }
  }, [memberId])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 bg-white rounded-xl border border-[#E8E3D9]">
        <canvas ref={canvasRef} className="rounded-lg" />
      </div>
      <p className="text-xs text-[#6B6560] font-mono tracking-widest">{memberId}</p>
    </div>
  )
}
