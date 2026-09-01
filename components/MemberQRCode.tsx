'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

export default function MemberQRCode({ memberCode }: { memberCode?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !memberCode) return
    QRCode.toCanvas(canvasRef.current, memberCode, {
      width: 180,
      margin: 2,
      color: {
        dark: '#1C1A17',
        light: '#ffffff',
      },
    })
  }, [memberCode])

  if (!memberCode) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-[180px] h-[180px] bg-[#D6D3CC] rounded-xl border border-[#C4C1BA] flex items-center justify-center">
          <p className="text-xs text-[#6B6560] text-center px-4">Member code not assigned yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 bg-white rounded-xl border border-[#C4C1BA]">
        <canvas ref={canvasRef} className="rounded-lg" />
      </div>
      <p className="text-xs text-[#6B6560] font-mono tracking-widest">{memberCode}</p>
    </div>
  )
}
