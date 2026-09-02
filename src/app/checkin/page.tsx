import Link from 'next/link'
import QRCode from 'qrcode'
import {
  UserCircle,
  UserPlus,
  Smartphone,
  LogOut,
  CalendarCheck,
  Sparkles,
  Shield,
  Users,
  Megaphone,
} from 'lucide-react'
import KioskGate from '@/components/checkin/kiosk-gate'

export const dynamic = 'force-dynamic'

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://pinnaclefitness.app'
  )
}

// Kiosk landing — the first screen people see walking in. Landscape
// iPad layout: compact QR rail on the left, every check-in path in a
// two-column grid on the right so all six options fit without
// scrolling.
const ACTIONS = [
  {
    href: '/checkin/member',
    title: "I'm a member",
    body: 'Scan your QR or find your name.',
    icon: UserCircle,
    tone: 'bg-turquoise-50 text-turquoise-700',
  },
  {
    href: '/checkin/guest',
    title: "I'm a guest",
    body: 'Meeting, event, tour, or trying us out.',
    icon: UserPlus,
    tone: 'bg-turquoise-50 text-turquoise-700',
  },
  {
    href: '/checkin/group',
    title: 'Members: group check-in',
    body: "On a team's group plan? Check in here.",
    icon: Users,
    tone: 'bg-turquoise-50 text-turquoise-700',
  },
  {
    href: '/checkin/booking',
    title: 'Here for a booking',
    body: 'Meeting room, conference room, events.',
    icon: CalendarCheck,
    tone: 'bg-blue-50 text-blue-700',
  },
  {
    href: '/checkin/signup',
    title: 'Become a member',
    body: 'Join in under a minute — free Explore Pass.',
    icon: Sparkles,
    tone: 'bg-lime-50 text-lime-700',
  },
  {
    href: '/checkin/staff',
    title: 'Staff, partners & private',
    body: 'Team, investors, associates — free entry.',
    icon: Shield,
    tone: 'bg-lime-50 text-lime-700',
  },
  {
    href: '/checkin/connect',
    title: 'Join & follow',
    body: 'WhatsApp group, Instagram, TikTok, LinkedIn.',
    icon: Megaphone,
    tone: 'bg-pink-50 text-pink-700',
  },
  {
    href: '/checkin/checkout',
    title: 'Heading out?',
    body: 'Tap your name to check out.',
    icon: LogOut,
    tone: 'bg-neutral-100 text-neutral-600',
  },
]

export default async function CheckinHome() {
  const phoneEntryUrl = `${getSiteUrl()}/checkin/start`
  const qrSvg = await QRCode.toString(phoneEntryUrl, {
    type: 'svg',
    margin: 1,
    width: 280,
    errorCorrectionLevel: 'M',
    color: { dark: '#0b0e0c', light: '#e5e8e6' },
  })

  return (
    <KioskGate>
      <div className="text-center mb-5">
        <h1 className="font-heading text-3xl md:text-4xl mb-1">
          Welcome to Pinnacle
        </h1>
        <p className="text-neutral-600">
          Scan with your phone, or tap an option below.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,320px)_1fr] gap-5 items-stretch">
        <div className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-turquoise-700 font-medium mb-3">
            <Smartphone size={14} />
            Scan with your phone
          </div>
          <div
            className="w-full max-w-[240px] aspect-square mb-3 [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="text-xs text-neutral-500 leading-relaxed">
            Point your camera at the code — check in, book a session, and manage
            your membership from your own phone.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 content-stretch">
          {ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-4 bg-white border border-neutral-200 rounded-lg p-4 md:p-5 hover:border-turquoise-500 hover:shadow transition"
              >
                <span
                  className={`w-12 h-12 rounded-md flex items-center justify-center shrink-0 ${action.tone}`}
                >
                  <Icon size={25} />
                </span>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block font-heading text-base md:text-lg leading-tight mb-0.5">
                    {action.title}
                  </span>
                  <span className="block text-xs md:text-sm text-neutral-600">
                    {action.body}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </KioskGate>
  )
}
