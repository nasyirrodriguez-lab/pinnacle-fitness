'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function Navbar() {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session)
    })
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-[#C4C1BA]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/PHOTO-2026-08-25-06-14-47.jpg" alt="Pinnacle Fitness" style={{ height: 40 }} />
        </a>
        <nav className="hidden md:flex items-center gap-8">
          <a href="/programs" className="text-sm text-[#6B6560] hover:text-[#1C1A17] transition">Programs</a>
          <a href="/coaches" className="text-sm text-[#6B6560] hover:text-[#1C1A17] transition">Coaches</a>
          <a href="/pricing" className="text-sm text-[#6B6560] hover:text-[#1C1A17] transition">Pricing</a>
          <a href="/contact" className="text-sm text-[#6B6560] hover:text-[#1C1A17] transition">Contact</a>
        </nav>
        <div className="flex items-center gap-3">
          <a href="/free-trial" className="text-sm text-[#6B6560] hover:text-[#1C1A17] transition hidden md:block">Free Trial</a>
          {loggedIn ? (
            <a href="/dashboard" className="px-4 py-2 bg-[#1F3D2B] text-white text-sm font-medium rounded-full hover:bg-[#163020] transition">My Dashboard</a>
          ) : (
            <a href="/auth" className="px-4 py-2 bg-[#54504A] text-white text-sm font-medium rounded-full hover:bg-[#3d3a35] transition">Join Now</a>
          )}
        </div>
      </div>
    </header>
  )
}
