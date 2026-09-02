'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  Home,
  QrCode,
  Settings as SettingsIcon,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQrSheet } from '@/components/qr-sheet/qr-sheet-context'

interface Tab {
  href: string
  label: string
  icon: typeof Home
  match: (path: string) => boolean
}

const LEFT_TABS: Tab[] = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: Home,
    match: (p) => p === '/dashboard',
  },
  {
    href: '/dashboard/bookings',
    label: 'Bookings',
    icon: Calendar,
    match: (p) => p.startsWith('/dashboard/bookings') || p === '/book',
  },
]

const RIGHT_TABS: Tab[] = [
  {
    href: '/dashboard/account',
    label: 'Account',
    icon: User,
    match: (p) =>
      p.startsWith('/dashboard/account') ||
      p.startsWith('/dashboard/plan') ||
      p.startsWith('/dashboard/invoices'),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: SettingsIcon,
    match: (p) => p.startsWith('/dashboard/settings'),
  },
]

// `hasVirtualOffice` is still forwarded from the layout but the bottom
// nav no longer surfaces a Mail tab — at 5 tabs + the FAB the bar is
// already dense on small phones. VO members reach mail from the
// dashboard home tile and `/dashboard/mail` directly.
interface Props {
  hasVirtualOffice?: boolean
}

export default function MobileBottomNav(_props: Props) {
  void _props
  const pathname = usePathname() ?? '/'
  const { openSheet } = useQrSheet()

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-neutral-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative grid grid-cols-5 items-stretch h-16">
        {LEFT_TABS.map((tab) => (
          <TabLink key={tab.href} tab={tab} pathname={pathname} />
        ))}

        {/* Center QR FAB — lifted above the bar */}
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => openSheet('show')}
            aria-label="Show my check-in QR"
            className="absolute -top-6 w-14 h-14 rounded-full bg-turquoise-500 hover:bg-turquoise-600 text-white shadow-lg flex items-center justify-center transition active:scale-95"
          >
            <QrCode size={26} />
          </button>
          <span className="mt-7 text-[10px] font-medium text-neutral-500">
            QR
          </span>
        </div>

        {RIGHT_TABS.map((tab) => (
          <TabLink key={tab.href} tab={tab} pathname={pathname} />
        ))}
      </div>
    </nav>
  )
}

function TabLink({ tab, pathname }: { tab: Tab; pathname: string }) {
  const Icon = tab.icon
  const active = tab.match(pathname)
  return (
    <Link
      href={tab.href}
      className={cn(
        'flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition',
        active
          ? 'text-turquoise-700'
          : 'text-neutral-500 hover:text-neutral-900'
      )}
    >
      <Icon size={22} />
      <span>{tab.label}</span>
    </Link>
  )
}
