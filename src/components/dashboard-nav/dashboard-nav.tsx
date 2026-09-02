'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Receipt,
  CreditCard,
  Mail,
  UserPlus,
  Settings,
  User,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const BASE_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/bookings', label: 'Bookings', icon: Calendar },
  { href: '/dashboard/account', label: 'Account', icon: User },
  { href: '/dashboard/plan', label: 'Plan', icon: CreditCard },
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
]

const TRAIL_ITEMS = [
  { href: '/dashboard/refer', label: 'Refer a friend', icon: UserPlus },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

interface Props {
  hasVirtualOffice?: boolean
  unreadMessages?: number
}

export default function DashboardNav({
  hasVirtualOffice = false,
  unreadMessages = 0,
}: Props) {
  const pathname = usePathname()
  const items = [
    ...BASE_ITEMS,
    { href: '/dashboard/messages', label: 'Messages', icon: Inbox },
    ...TRAIL_ITEMS,
  ]

  return (
    <nav className="space-y-1">
      {items.map((item) => {
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
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              active
                ? 'bg-turquoise-50 text-turquoise-900'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
            )}
          >
            <Icon size={18} />
            <span className="flex-1">{item.label}</span>
            {showBadge && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-turquoise-500 text-white text-xs font-bold">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
