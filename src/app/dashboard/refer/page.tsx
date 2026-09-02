import { redirect } from 'next/navigation'
import { Gift, CheckCircle2, Clock } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createAdminClient } from '@/utils/supabase/admin'
import { ensureReferralCode } from '@/lib/referrals/ensure-code'
import { fmtAstDate } from '@/lib/time/ast'
import ShareLinkCard from '@/components/referral-form/share-link-card'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Refer a friend — The Worx',
  robots: { index: false, follow: false },
}

interface ReferralRow {
  id: string
  status: 'signed_up' | 'qualified' | 'rewarded' | 'expired' | 'voided'
  created_at: string
  rewarded_at: string | null
  referred:
    | { full_name: string | null; email: string }
    | { full_name: string | null; email: string }[]
    | null
}

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://theworx.io'
  )
}

function statusBadge(status: ReferralRow['status']) {
  switch (status) {
    case 'rewarded':
      return {
        label: 'Reward unlocked',
        className: 'bg-turquoise-100 text-turquoise-800',
      }
    case 'qualified':
      return { label: 'Qualified', className: 'bg-lime-100 text-lime-800' }
    case 'signed_up':
      return {
        label: 'Signed up',
        className: 'bg-neutral-100 text-neutral-700',
      }
    case 'expired':
      return { label: 'Expired', className: 'bg-neutral-100 text-neutral-500' }
    case 'voided':
      return {
        label: 'Voided',
        className: 'bg-neutral-100 text-neutral-500',
      }
  }
}

const fmtDate = fmtAstDate

export default async function ReferPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const admin = createAdminClient()
  const code = await ensureReferralCode(admin, user.id)
  const shareUrl = code ? `${getSiteUrl()}/r/${code}` : ''

  const { data: rawReferrals } = await admin
    .from('referrals')
    .select(
      'id, status, created_at, rewarded_at, referred:referred_user_id(full_name, email)'
    )
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false })

  const referrals = ((rawReferrals as unknown as ReferralRow[]) ?? []).map(
    (r) => ({
      ...r,
      referred: Array.isArray(r.referred)
        ? (r.referred[0] ?? null)
        : r.referred,
    })
  )

  const signedUpCount = referrals.filter((r) => r.status === 'signed_up').length
  const rewardedCount = referrals.filter(
    (r) => r.status === 'rewarded' || r.status === 'qualified'
  ).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl mb-1">Refer a friend</h1>
        <p className="text-neutral-600 max-w-xl">
          Share your personal link. When a friend signs up and makes their first
          purchase, you both get a free day pass on us.
        </p>
      </div>

      {/* Big share card */}
      {code ? (
        <ShareLinkCard code={code} shareUrl={shareUrl} />
      ) : (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 text-sm text-orange-900">
          Couldn&apos;t generate your referral code. Refresh and try again, or
          email team@theworx.io.
        </div>
      )}

      {/* Reward summary */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
            <Gift size={20} />
          </div>
          <div className="flex-1">
            <p className="font-heading text-lg mb-1">How it works</p>
            <ol className="text-sm text-neutral-700 space-y-1 list-decimal list-inside">
              <li>Share your personal link above.</li>
              <li>
                Friend signs up via the link and makes their first purchase (a
                day pass or a monthly plan).
              </li>
              <li>
                You both get a free Day Pass added to your account. Use it any
                time in the next 90 days.
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Stats */}
      {referrals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat
            label="Total referred"
            value={referrals.length}
            icon={<Gift size={16} />}
          />
          <Stat
            label="Pending"
            value={signedUpCount}
            icon={<Clock size={16} />}
          />
          <Stat
            label="Day passes earned"
            value={rewardedCount}
            icon={<CheckCircle2 size={16} />}
            highlight
          />
        </div>
      )}

      {/* Referral table */}
      {referrals.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-200">
            <h2 className="font-heading text-base">Your referrals</h2>
          </div>
          <ul className="divide-y divide-neutral-100">
            {referrals.map((r) => {
              const profile = r.referred as {
                full_name: string | null
                email: string
              } | null
              const badge = statusBadge(r.status)
              return (
                <li
                  key={r.id}
                  className="px-5 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {profile?.full_name ?? profile?.email ?? 'A friend'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Signed up {fmtDate(r.created_at)}
                      {r.rewarded_at && (
                        <> · rewarded {fmtDate(r.rewarded_at)}</>
                      )}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <p className="text-xs text-neutral-500">
        Want to send an email instead?{' '}
        <a
          href={`mailto:?subject=${encodeURIComponent('Come check out The Worx with me')}&body=${encodeURIComponent(
            `Hey — I'm a member at The Worx, our coworking space in Port of Spain. I think you'd like it. Sign up through my link and we both get a free day:\n\n${shareUrl}`
          )}`}
          className="text-turquoise-700 underline"
        >
          Open your email client
        </a>
        .
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  icon,
  highlight,
}: {
  label: string
  value: number
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={
        highlight
          ? 'bg-turquoise-50 border border-turquoise-200 rounded-lg p-4'
          : 'bg-white border border-neutral-200 rounded-lg p-4'
      }
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-500 mb-1">
        {icon}
        {label}
      </div>
      <p className="font-heading text-2xl">{value}</p>
    </div>
  )
}
