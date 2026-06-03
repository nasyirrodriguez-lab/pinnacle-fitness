import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 mt-auto">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500">
                <span className="text-xs font-black text-white">P</span>
              </div>
              <span className="font-bold text-white tracking-tight">Pinnacle Fitness</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-xs">
              Your premium gym experience. Train harder, recover smarter, live better.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Explore</p>
            <ul className="space-y-2">
              {[
                { href: '/', label: 'Home' },
                { href: '/pricing', label: 'Pricing' },
                { href: '/coaches', label: 'Coaches' },
                { href: '/contact', label: 'Contact' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Members</p>
            <ul className="space-y-2">
              {[
                { href: '/auth', label: 'Log In' },
                { href: '/auth', label: 'Sign Up' },
                { href: '/dashboard', label: 'Dashboard' },
              ].map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Hours</p>
            <ul className="space-y-1 text-sm text-zinc-500">
              <li>Mon–Fri: 5am – 11pm</li>
              <li>Sat: 6am – 10pm</li>
              <li>Sun: 7am – 9pm</li>
              <li className="text-orange-400 text-xs mt-2">Elite: 24/7 access</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-zinc-600">© {new Date().getFullYear()} Pinnacle Fitness. All rights reserved.</p>
          <p className="text-xs text-zinc-700">Built with Next.js + Supabase</p>
        </div>
      </div>
    </footer>
  )
}
