'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

export default function MemberQRCode({ memberId }: { memberId: string | null | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !memberId) return
    QRCode.toCanvas(canvasRef.current, memberId, {
      width: 180,
      margin: 2,
      color: {
        dark: '#1C1A17',
        light: '#ffffff',
      },
    })
  }, [memberId])

  if (!memberId) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-[180px] h-[180px] bg-[#F5F0E8] rounded-xl border border-[#E8E3D9] flex items-center justify-center">
          <p className="text-xs text-[#6B6560] text-center px-4">Member code not assigned yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 bg-white rounded-xl border border-[#E8E3D9]">
        <canvas ref={canvasRef} className="rounded-lg" />
      </div>
      <p className="text-xs text-[#6B6560] font-mono tracking-widest">{memberId}</p>
    </div>
  )
}
