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
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#3A3733] border-b border-[#2a2825]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-1.5 select-none">
          <span className="font-serif italic text-xl text-[#E8E4DC] leading-none">Pinnacle</span>
          <span className="text-[0.6rem] font-semibold tracking-[0.2em] uppercase text-[#E8E4DC]/40 leading-none self-end mb-0.5">GYM</span>
        </a>
        <nav className="hidden md:flex items-center gap-8">
          <a href="/programs" className="text-sm text-[#E8E4DC]/70 hover:text-[#E8E4DC] transition">Programs</a>
          <a href="/coaches" className="text-sm text-[#E8E4DC]/70 hover:text-[#E8E4DC] transition">Coaches</a>
          <a href="/pricing" className="text-sm text-[#E8E4DC]/70 hover:text-[#E8E4DC] transition">Pricing</a>
          <a href="/contact" className="text-sm text-[#E8E4DC]/70 hover:text-[#E8E4DC] transition">Contact</a>
        </nav>
        <div className="flex items-center gap-3">
          <a href="/free-trial" className="text-sm text-[#E8E4DC]/70 hover:text-[#E8E4DC] transition hidden md:block">Free Trial</a>
          {loggedIn ? (
            <a href="/dashboard" className="px-4 py-2 bg-[#E8E4DC] text-[#3A3733] text-sm font-medium rounded-full hover:bg-white transition">My Dashboard</a>
          ) : (
            <a href="/auth" className="px-4 py-2 bg-[#C85C2D] text-white text-sm font-medium rounded-full hover:bg-[#b34f26] transition">Join Now</a>
          )}
        </div>
      </div>
    </header>
  )
}
