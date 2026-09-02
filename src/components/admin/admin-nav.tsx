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
  FileText,
  Gift,
  MessageSquareHeart,
  TrendingUp,
  ClipboardList,
  ShoppingBag,
  Settings,
  BadgeCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/applications', label: 'Applications', icon: ClipboardList },
  { href: '/admin/members', label: 'Members', icon: Users },
  { href: '/admin/bookings', label: 'Sessions', icon: Calendar },
  { href: '/admin/payments', label: 'Payments', icon: Receipt },
  { href: '/admin/invoices', label: 'Invoices', icon: FileText },
  { href: '/admin/finance', label: 'Finance', icon: TrendingUp },
  { href: '/admin/shop', label: 'Shop', icon: ShoppingBag },
  { href: '/admin/catalog', label: 'Packages', icon: Package },
  { href: '/admin/notifications', label: 'Messages', icon: Mail },
  { href: '/admin/feedback', label: 'Feedback', icon: MessageSquareHeart },
  { href: '/admin/welcome-pack', label: 'Welcome pack', icon: Gift },
  { href: '/admin/members/designations', label: 'Team', icon: BadgeCheck },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/admin/checkin', label: 'Check-in', icon: ScanLine },
] as const

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const exact = 'exact' in item && item.exact
        const active = exact
          ? pathname === item.href
          : pathname === item.href || pathname?.startsWith(`${item.href}/`)
        // Members link must not light up for /admin/members/designations.
        const teamActive = pathname?.startsWith('/admin/members/designations')
        const isActive =
          item.href === '/admin/members' ? active && !teamActive : active
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium transition-colors',
              isActive
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
