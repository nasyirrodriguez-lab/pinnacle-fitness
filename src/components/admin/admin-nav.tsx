'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Calendar,
  Receipt,
  Package,
  Mail,
  ScanLine,
  Coins,
  FileText,
  Gift,
  MessageSquareHeart,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/members', label: 'Members', icon: Users, exact: false },
  {
    href: '/admin/bookings',
    label: 'Bookings',
    icon: Calendar,
    exact: false,
  },
  {
    href: '/admin/payments',
    label: 'Payments',
    icon: Receipt,
    exact: false,
  },
  {
    href: '/admin/invoices',
    label: 'Invoices',
    icon: FileText,
    exact: false,
  },
  {
    href: '/admin/finance',
    label: 'Finance',
    icon: TrendingUp,
    exact: false,
  },
  {
    href: '/admin/credits',
    label: 'Credits',
    icon: Coins,
    exact: false,
  },
  {
    href: '/admin/catalog',
    label: 'Packages',
    icon: Package,
    exact: false,
  },
  {
    href: '/admin/notifications',
    label: 'Messages',
    icon: Mail,
    exact: false,
  },
  {
    href: '/admin/welcome-pack',
    label: 'Welcome Pack',
    icon: Gift,
    exact: false,
  },
  {
    href: '/admin/feedback',
    label: 'Feedback',
    icon: MessageSquareHeart,
    exact: false,
  },
  {
    href: '/admin/checkin',
    label: 'Check-in',
    icon: ScanLine,
    exact: false,
  },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname?.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              active
                ? 'bg-darkBlue-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
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
