import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCheckinToken } from '@/lib/checkin/qr'
import { createAdminClient } from '@/utils/supabase/admin'
import { memberAccess } from '@/lib/gym/entitlement'
import { nextPtBooking } from '@/lib/members/next-booking'
import { loadGymSettings } from '@/lib/gym/settings'
import { astIsSameDay, fmtAstTime, fmtAstWeekdayDate } from '@/lib/time/ast'
import LeavingButton from '@/components/dashboard/leaving-button'
import HomeScreenNudge from '@/components/dashboard/home-screen-nudge'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My QR — Pinnacle Fitness',
  robots: { index: false, follow: false },
}

function buildStatusLine(
  next: Awaited<ReturnType<typeof nextPtBooking>>,
  access: Awaited<ReturnType<typeof memberAccess>>,
  settings: Awaited<ReturnType<typeof loadGymSettings>>
): string {
  const now = Date.now()
  if (next && astIsSameDay(next.startIso, new Date(now))) {
    const cancelBy = new Date(
      new Date(next.startIso).getTime() - settings.ptCancelHours * 60 * 60 * 1000
    )
    return `PT with ${next.coachName} today ${fmtAstTime(next.startIso)}${
      cancelBy.getTime() > now
        ? ` · cancel free until ${fmtAstTime(cancelBy.toISOString())}`
        : ''
    }`
  }
  if (next) {
    return `Next PT: ${next.coachName} · ${fmtAstWeekdayDate(next.startIso)} ${fmtAstTime(next.startIso)}`
  }
  if (access.openGymUnlimited) return 'Open gym · included in your plan'
  return `Open gym · ${access.openGymBalance} visit${access.openGymBalance === 1 ? '' : 's'} left`
}

export default async function MyQrPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in?next=/my-qr')
  const admin = createAdminClient()
  const [access, next, settings] = await Promise.all([
    memberAccess(admin, user.id),
    nextPtBooking(admin, user.id),
    loadGymSettings(admin),
  ])

  const token = issueCheckinToken(user.id)
  const svg = await QRCode.toString(token, {
    type: 'svg',
    margin: 1,
    width: 320,
    errorCorrectionLevel: 'M',
    color: { dark: '#0B0E0C', light: '#E5E8E6' },
  })

  const statusLine = buildStatusLine(next, access, settings)

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10 text-center">
      <p className="text-[11px] tracking-[0.18em] uppercase text-ice-mute mb-2">
        Scan at the iPad
      </p>
      <h1 className="heading-display text-3xl mb-6">
        {user.fullName || user.email}
      </h1>

      <div
        className="w-[min(78vw,320px)] aspect-square rounded-lg overflow-hidden bg-ice p-3 [&_svg]:w-full [&_svg]:h-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <p className="mt-6 text-sm text-ice-dim max-w-xs">{statusLine}</p>
      {access.subscriptionStatus === 'lapsed' && (
        <p className="mt-2 text-sm text-bad max-w-xs">
          Your plan has lapsed — renew before you head in, or pay at the desk.
        </p>
      )}

      <div className="mt-8 flex flex-col items-center gap-4">
        <LeavingButton />
        <HomeScreenNudge />
        <p className="text-xs text-ice-mute">
          This code refreshes daily. If it won’t scan, find your name on the
          iPad and use your PIN.
        </p>
        <Link href="/dashboard" className="text-sm text-ice-dim underline">
          Back to home
        </Link>
      </div>
    </div>
  )
}
