'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  CreditCard,
  Settings,
  QrCode,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/bookings', label: 'Book', icon: Calendar },
  { href: '/my-qr', label: 'My QR', icon: QrCode },
  { href: '/dashboard/plan', label: 'Plan', icon: CreditCard },
  { href: '/dashboard/messages', label: 'Messages', icon: Inbox },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

interface Props {
  hasVirtualOffice?: boolean
  unreadMessages?: number
}

export default function DashboardNav({ unreadMessages = 0 }: Props) {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {ITEMS.map((item) => {
        const Icon = item.icon
        const active =
          item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname?.startsWith(item.href)
        const showBadge =
          item.href === '/dashboard/messages' && unreadMessages > 0
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors',
              active
                ? 'bg-turf text-turf-ink'
                : 'text-ice-dim hover:bg-bronze hover:text-ice'
            )}
          >
            <Icon size={18} />
            <span className="flex-1">{item.label}</span>
            {showBadge && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-bold',
                  active ? 'bg-turf-ink text-turf' : 'bg-turf text-turf-ink'
                )}
              >
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
