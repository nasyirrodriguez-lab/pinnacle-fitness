'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Users, Clock, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/coach', label: 'Today', icon: CalendarDays, exact: true },
  { href: '/coach/clients', label: 'My clients', icon: Users, exact: false },
  { href: '/coach/availability', label: 'Availability', icon: Clock, exact: false },
  { href: '/coach/earnings', label: 'Earnings', icon: Wallet, exact: false },
]

export default function CoachNav() {
  const pathname = usePathname()
  return (
    <nav className="space-y-1">
      {ITEMS.map((item) => {
        const Icon = item.icon
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname?.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium transition-colors',
              active
                ? 'bg-turquoise-500 text-black'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            )}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
