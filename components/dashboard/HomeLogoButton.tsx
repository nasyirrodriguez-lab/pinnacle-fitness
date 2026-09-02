'use client'

import { useRouter } from 'next/navigation'

export default function HomeLogoButton() {
  const router = useRouter()
  return (
    <button onClick={() => router.push('/')} className="flex items-center gap-1.5 select-none cursor-pointer">
      <span className="font-serif italic text-xl text-[#3A3733] leading-none">Pinnacle</span>
      <span className="text-[0.6rem] font-semibold tracking-[0.2em] uppercase text-[#3A3733]/40 leading-none self-end mb-0.5">GYM</span>
    </button>
  )
}
