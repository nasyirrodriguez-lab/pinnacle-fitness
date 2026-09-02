'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  Home,
  QrCode,
  CreditCard,
  Settings as SettingsIcon,
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
    label: 'Book',
    icon: Calendar,
    match: (p) => p.startsWith('/dashboard/bookings') || p.startsWith('/book'),
  },
]

const RIGHT_TABS: Tab[] = [
  {
    href: '/dashboard/plan',
    label: 'Plan',
    icon: CreditCard,
    match: (p) =>
      p.startsWith('/dashboard/plan') ||
      p.startsWith('/dashboard/account') ||
      p.startsWith('/dashboard/invoices'),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: SettingsIcon,
    match: (p) =>
      p.startsWith('/dashboard/settings') ||
      p.startsWith('/dashboard/messages'),
  },
]

interface Props {
  hasVirtualOffice?: boolean
}

// Floating pill bar: four tabs with the QR in the middle as the one turf
// circle — the fastest thing to reach at the door.
export default function MobileBottomNav(_props: Props) {
  void _props
  const pathname = usePathname() ?? '/'
  const { openSheet } = useQrSheet()

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 px-4"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="grid grid-cols-5 items-center h-16 rounded-full bg-bronze border border-bronze-line shadow-[0_12px_40px_rgba(0,0,0,0.5)] px-2">
        {LEFT_TABS.map((tab) => (
          <TabLink key={tab.href} tab={tab} pathname={pathname} />
        ))}

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => openSheet('show')}
            aria-label="Show my check-in QR"
            className="w-13 h-13 rounded-full bg-turf text-turf-ink flex items-center justify-center transition active:scale-95 shadow-[0_0_24px_rgba(78,201,92,0.35)]"
          >
            <QrCode size={26} />
          </button>
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
      className="flex items-center justify-center"
      aria-label={tab.label}
      aria-current={active ? 'page' : undefined}
    >
      <span
        className={cn(
          'flex items-center justify-center w-11 h-11 rounded-full transition',
          active ? 'bg-ice text-ground' : 'text-ice-dim hover:text-ice'
        )}
      >
        <Icon size={22} />
      </span>
    </Link>
  )
}
