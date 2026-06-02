import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MemberQRCode from '@/components/MemberQRCode'
import LogoutButton from '@/components/LogoutButton'
import RenewBanner from '@/components/dashboard/RenewBanner'
import type { Member } from '@/lib/types'

const planColors: Record<string, string> = {
  basic: 'bg-zinc-700 text-zinc-200',
  premium: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  elite: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
}

const planPerks: Record<string, string[]> = {
  basic: ['Gym floor access', 'Locker rooms', 'Cardio equipment'],
  premium: ['All Basic perks', 'Group classes', 'Sauna & steam room', '2 guest passes/month'],
  elite: ['All Premium perks', '4 PT sessions/month', '24/7 access', 'Nutrition coaching'],
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', user.id)
    .single<Member>()

  if (!member) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400">Member profile not found.</p>
          <LogoutButton />
        </div>
      </div>
    )
  }

  const joinDate = new Date(member.join_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const periodEndLabel = member.current_period_end
    ? new Date(member.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No active subscription'

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-500 rounded-md flex items-center justify-center">
              <span className="text-white font-black text-xs">P</span>
            </div>
            <span className="text-white font-bold tracking-tight">Pinnacle Fitness</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/payments"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              Billing
            </Link>
            {member.role === 'admin' && (
              <Link
                href="/admin"
                className="text-xs text-orange-400 hover:text-orange-300 font-medium border border-orange-500/30 px-3 py-1.5 rounded-lg hover:bg-orange-500/10 transition"
              >
                Admin
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Renew banner */}
        {member.current_period_end && (
          <div className="mb-8">
            <RenewBanner periodEnd={member.current_period_end} planSlug={member.plan_type} />
          </div>
        )}

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Welcome back, <span className="text-orange-400">{member.name.split(' ')[0]}</span>
          </h1>
          <p className="text-zinc-500 mt-1">Here's your membership overview</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Member Card */}
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{member.name}</h2>
                <p className="text-zinc-500 text-sm mt-0.5">{member.email}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${planColors[member.plan_type]}`}>
                {member.plan_type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Member Since</p>
                <p className="text-white font-semibold text-sm">{joinDate}</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Member ID</p>
                <p className="text-orange-400 font-mono font-semibold text-sm">{member.member_id}</p>
              </div>
            </div>

            {/* Plan perks */}
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Your Plan Includes</p>
              <ul className="space-y-2">
                {planPerks[member.plan_type].map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="w-4 h-4 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* QR Code Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-4">Gym Check-In QR</p>
            <MemberQRCode memberId={member.member_id} />
            <p className="text-xs text-zinc-600 mt-4 text-center">
              Show this code at the front desk to check in
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'Plan Status',
              value: member.status === 'active' ? 'Active' : 'Suspended',
              color: member.status === 'active' ? 'text-green-400' : 'text-red-400',
            },
            {
              label: 'Plan Type',
              value: member.plan_type.charAt(0).toUpperCase() + member.plan_type.slice(1),
              color: 'text-orange-400',
            },
            {
              label: 'Next Billing',
              value: periodEndLabel,
              color: 'text-zinc-300',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
              <p className={`font-semibold text-xs sm:text-sm ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="mt-4 flex gap-3 flex-wrap">
          <Link
            href="/dashboard/payments"
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition border border-zinc-800 rounded-lg px-3 py-2 hover:bg-zinc-900"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            View payment history
          </Link>
          <Link
            href="/pricing"
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition border border-zinc-800 rounded-lg px-3 py-2 hover:bg-zinc-900"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Upgrade plan
          </Link>
        </div>
      </main>
    </div>
  )
}
