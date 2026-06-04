'use client'

import { useRouter } from 'next/navigation'

export default function HomeLogoButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push('/')}
      className="flex items-baseline gap-1.5 cursor-pointer"
    >
      <span className="font-serif italic text-xl text-[#1C1A17]">Pinnacle</span>
      <span className="text-xs tracking-[0.15em] uppercase font-medium text-[#6B6560]">GYM</span>
    </button>
  )
}
