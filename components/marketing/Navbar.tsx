'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const links = [
  { href: '/', label: 'Home' },
  { href: '/programs', label: 'Programs' },
  { href: '/coaches', label: 'Coaches' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
  { href: '/free-trial', label: 'Free Trial' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 60)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isHome = pathname === '/'
  const transparent = isHome && !scrolled

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
          transparent
            ? 'bg-transparent'
            : 'bg-[#F5F0E8]/95 backdrop-blur-sm border-b border-[#E8E3D9]'
        }`}
      >
        <div className="mx-auto max-w-6xl px-6 sm:px-12">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <button
              onClick={() => router.push('/')}
              className="flex items-baseline gap-1.5 cursor-pointer"
            >
              <span className={`font-serif italic text-2xl font-normal ${transparent ? 'text-white' : 'text-[#1C1A17]'}`}>
                Pinnacle
              </span>
              <span className={`text-xs tracking-[0.15em] uppercase font-medium ${transparent ? 'text-white/80' : 'text[#6B6560]'}`}>
                GYM
              </span>
            </button>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-7">
              {links.map(({ href, label }) =>
                href === '/free-trial' ? (
                  <Link
                    key={href}
                    href={href}
                    className={`text-sm font-medium transition-colors ${
                      transparent
                        ? 'text-orange-300 hover:text-white'
                        : 'text-[#C85C2D] hover:text-[#b34f26]'
                    }`}
                  >
                    {label}
                  </Link>
                ) : (
                  <Link
                    key={href}
                    href={href}
                    className={`text-sm transition-colors ${
                      transparent
                        ? 'text-white/80 hover:text-white'
                        : 'text-[#6B6560] hover:text-[#1C1A17]'
                    }`}
                  >
                    {label}
                  </Link>
                )
              )}
              <Link
                href="/auth"
                className={`text-sm transition-colors ${
                  transparent ? 'text-white/80 hover:text-white' : 'text-[#6B6560] hover:text-[#1C1A17]'
                }`}
              >
                Log In
              </Link>
              <Link
                href="/auth"
                className="bg-[#C85C2D] text-white rounded-full px-7 py-3 text-sm font-medium hover:bg-[#b34f26] transition-colors"
              >
                Join Now
              </Link>
            </nav>

            {/* Hamburger */}
            <button
              onClick={() => setOpen(true)}
              className="md:hidden flex flex-col gap-1 p-2"
              aria-label="Open menu"
            >
              <span className={`block h-0.5 w-5 ${transparent ? 'bg-white' : 'bg-[#1C1A17]'}`} />
              <span className={`block h-0.5 w-5 ${transparent ? 'bg-white' : 'bg-[#1C1A17]'}`} />
              <span className={`block h-0.5 w-5 ${transparent ? 'bg-white' : 'bg-[#1C1A17]'}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile full-screen overlay */}
      {open && (
        <div className="fixed inset-0 z-[60] bg-[#1F3D2B] flex flex-col px-8 py-8">
          <div className="flex items-center justify-between mb-12">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-baseline gap-1.5">
              <span className="font-serif italic text-2xl text-white">Pinnacle</span>
              <span className="text-xs tracking-[0.15em] uppercase font-medium text-white/70">GYM</span>
            </Link>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="text-white/70 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col gap-6 flex-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`text-2xl font-serif transition-colors ${
                  href === '/free-trial'
                    ? 'text-orange-300 hover:text-orange-200'
                    : 'text-white hover:text-white/70'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-3 mt-8">
            <Link
              href="/auth"
              onClick={() => setOpen(false)}
              className="text-center text-white/80 text-sm font-medium py-3"
            >
              Log In
            </Link>
            <Link
              href="/auth"
              onClick={() => setOpen(false)}
              className="bg-[#C85C2D] text-white rounded-full px-7 py-3 text-sm font-medium text-center hover:bg-[#b34f26] transition-colors"
            >
              Join Now
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
