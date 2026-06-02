'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/coaches', label: 'Coaches' },
  { href: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
              <span className="text-xs font-black text-white">P</span>
            </div>
            <span className="text-base font-bold tracking-tight text-white">Pinnacle Fitness</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors ${
                  pathname === href
                    ? 'text-orange-400'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/auth"
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/auth"
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 transition-colors"
            >
              Join Now
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Toggle menu"
          >
            <span className={`block h-0.5 w-5 bg-zinc-400 transition-all ${open ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block h-0.5 w-5 bg-zinc-400 transition-all ${open ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-5 bg-zinc-400 transition-all ${open ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden border-t border-zinc-800 py-4 space-y-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`block px-2 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  pathname === href
                    ? 'text-orange-400 bg-orange-500/10'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="pt-3 flex flex-col gap-2 px-2">
              <Link
                href="/auth"
                onClick={() => setOpen(false)}
                className="block text-center py-2.5 text-sm font-medium text-zinc-400 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/auth"
                onClick={() => setOpen(false)}
                className="block text-center py-2.5 text-sm font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-400 transition-colors"
              >
                Join Now
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
