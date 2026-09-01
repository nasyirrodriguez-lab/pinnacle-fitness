'use client'

import { useRouter } from 'next/navigation'

export default function HomeLogoButton() {
  const router = useRouter()
  return (
    <button onClick={() => router.push('/')} className="cursor-pointer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/pinnacle-logo.svg" alt="Pinnacle Fitness" style={{ height: 40 }} />
    </button>
  )
}
