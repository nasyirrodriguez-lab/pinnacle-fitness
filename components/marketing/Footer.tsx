import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-[#F5F0E8] border-t border-[#E8E3D9] mt-auto">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-3">
              <a href="/">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/PHOTO-2026-08-25-06-14-47.jpg" alt="Pinnacle Fitness" style={{ height: 36 }} />
              </a>
            </div>
            <p className="text-sm text-[#6B6560] leading-relaxed max-w-xs">
              An outdoor training community where progress is the goal and the people around you make it happen.
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#6B6560] uppercase tracking-[0.15em] mb-4">Explore</p>
            <ul className="space-y-2.5">
              {[
                { href: '/', label: 'Home' },
                { href: '/programs', label: 'Programs' },
                { href: '/coaches', label: 'Coaches' },
                { href: '/pricing', label: 'Pricing' },
                { href: '/contact', label: 'Contact' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-[#6B6560] hover:text-[#1C1A17] transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium text-[#6B6560] uppercase tracking-[0.15em] mb-4">Members</p>
            <ul className="space-y-2.5">
              {[
                { href: '/auth', label: 'Log In' },
                { href: '/auth', label: 'Sign Up' },
                { href: '/dashboard', label: 'Dashboard' },
              ].map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-[#6B6560] hover:text-[#1C1A17] transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium text-[#6B6560] uppercase tracking-[0.15em] mb-4">Hours</p>
            <ul className="space-y-1.5 text-sm text-[#6B6560]">
              <li>Mon–Fri: 5:30 AM – 7:00 PM</li>
              <li>Sat: 7:00 AM – 1:00 PM</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#E8E3D9] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#6B6560]">© {new Date().getFullYear()} Pinnacle Fitness. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
