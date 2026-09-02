import Link from 'next/link'
import QRCode from 'qrcode'
import { ArrowLeft, Instagram, Linkedin, Music2 } from 'lucide-react'
import KioskGate from '@/components/checkin/kiosk-gate'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Join & follow | The Worx',
  robots: { index: false, follow: false },
}

// Join & follow: WhatsApp community QR plus every social handle, each
// as a scannable code — nobody browses on the kiosk, they scan and go.
const SOCIALS = [
  {
    label: 'Instagram',
    handle: '@wearetheworx',
    url: 'https://www.instagram.com/wearetheworx',
    icon: Instagram,
    tone: 'text-pink-600',
  },
  {
    label: 'TikTok',
    handle: '@wearetheworx',
    url: 'https://www.tiktok.com/@wearetheworx',
    icon: Music2,
    tone: 'text-neutral-900',
  },
  {
    label: 'LinkedIn',
    handle: 'The Worx',
    url: 'https://www.linkedin.com/company/the-worx',
    icon: Linkedin,
    tone: 'text-blue-700',
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
          Join the community
        </h1>
        <p className="text-neutral-600">
          Scan with your phone — hop in the members&apos; chat and follow along.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        <div className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col items-center text-center">
          <p className="font-heading text-lg mb-1">The Worx Members</p>
          <p className="text-xs text-neutral-500 mb-3">
            WhatsApp community group
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/connect/whatsapp-group.png"
            alt="WhatsApp group QR code"
            className="w-full max-w-60 rounded-lg"
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
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
      </div>
    </KioskGate>
  )
}
