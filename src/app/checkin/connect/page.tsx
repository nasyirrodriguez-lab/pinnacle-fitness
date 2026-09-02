import Link from 'next/link'
import QRCode from 'qrcode'
import { ArrowLeft, Instagram, FileText } from 'lucide-react'
import KioskGate from '@/components/checkin/kiosk-gate'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Want to join? | Pinnacle Fitness',
  robots: { index: false, follow: false },
}

// Want to join: the application link and Instagram as scannable codes —
// nobody fills a form on the kiosk, they scan and do it on their phone.
const SOCIALS = [
  {
    label: 'Apply to join',
    handle: 'pinnaclefitness.app/apply',
    url: 'https://pinnaclefitness.app/apply',
    icon: FileText,
    tone: 'text-turquoise-700',
  },
  {
    label: 'Instagram',
    handle: '@pinnaclefitnesstt',
    url: 'https://www.instagram.com/pinnaclefitnesstt',
    icon: Instagram,
    tone: 'text-pink-600',
  },
]

export default async function CheckinConnectPage() {
  const socialQrs = await Promise.all(
    SOCIALS.map(async (s) => ({
      ...s,
      qrSvg: await QRCode.toString(s.url, {
        type: 'svg',
        margin: 1,
        width: 200,
        errorCorrectionLevel: 'M',
        color: { dark: '#0a1620', light: '#ffffff' },
      }),
    }))
  )

  return (
    <KioskGate>
      <Link
        href="/checkin"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      <div className="text-center mb-6">
        <h1 className="font-heading text-3xl md:text-4xl mb-2">
          Want to train here?
        </h1>
        <p className="text-neutral-600">
          Membership is by application. Scan to apply from your phone, and
          follow along on Instagram.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        {socialQrs.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className="bg-white border border-neutral-200 rounded-lg p-4 flex items-center gap-4"
            >
              <div
                className="w-24 h-24 shrink-0 [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
                dangerouslySetInnerHTML={{ __html: s.qrSvg }}
              />
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 font-heading text-lg">
                  <Icon size={18} className={s.tone} />
                  {s.label}
                </p>
                <p className="text-sm text-neutral-600">{s.handle}</p>
              </div>
            </div>
          )
        })}
      </div>
    </KioskGate>
  )
}
