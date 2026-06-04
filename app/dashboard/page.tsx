import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MemberQRCode from '@/components/MemberQRCode'
import LogoutButton from '@/components/LogoutButton'
import RenewBanner from '@/components/dashboard/RenewBanner'
import HomeLogoButton from '@/components/dashboard/HomeLogoButton'
import type { Member } from '@/lib/types'

const planColors: Record<string, string> = {
  basic: 'bg-[#E8E3D9] text-[#6B6560]',
  premium: 'bg-[#1F3D2B]/10 text-[#1F3D2B] border border-[#1F3D2B]/20',
  elite: 'bg-[#C85C2D]/10 text-[#C85C2D] border border-[#C85C2D]/20',
}

const planPerks: Record<string, string[]> = {
  basic: ['Eight coached sessions per month', 'Locker rooms', 'Full gym access'],
  premium: ['Twelve coached sessions per month', 'All basic perks', 'Priority scheduling'],
  elite: ['Unlimited coached sessions', 'Open gym access', 'Priority scheduling', '24/7 access'],
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
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#6B6560]">Member profile not found.</p>
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
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <header className="border-b border-[#E8E3D9] bg-[#F5F0E8]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <HomeLogoButton />
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/payments"
              className="text-xs text-[#6B6560] hover:text-[#1C1A17] transition"
            >
              Billing
            </Link>
            {member.role === 'admin' && (
              <Link
                href="/admin"
                className="text-xs text-[#C85C2D] hover:text-[#b34f26] font-medium border border-[#C85C2D]/30 px-3 py-1.5 rounded-lg hover:bg-[#C85C2D]/5 transition"
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
            <RenewBanner periodEnd={member.current_period_end} planSlug={member.plan_type ?? 'basic'} />
          </div>
        )}

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-[#1C1A17]">
            Welcome back, <span className="text-[#C85C2D]">{(member?.name || 'Member').split(' ')[0]}</span>
          </h1>
          <p className="text-[#6B6560] mt-1">Here&apos;s your membership overview</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Member Card */}
          <div className="lg:col-span-2 bg-white border border-[#E8E3D9] rounded-2xl p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="font-serif text-xl text-[#1C1A17]">{member.name ?? 'Member'}</h2>
                <p className="text-[#6B6560] text-sm mt-0.5">{member.email}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide ${planColors[member.plan_type ?? ''] ?? 'bg-[#E8E3D9] text-[#6B6560]'}`}>
                {member.plan_type ?? '—'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#F5F0E8] rounded-xl p-4">
                <p className="text-xs text-[#6B6560] uppercase tracking-[0.1em] mb-1">Member Since</p>
                <p className="text-[#1C1A17] font-medium text-sm">{joinDate}</p>
              </div>
              <div className="bg-[#F5F0E8] rounded-xl p-4">
                <p className="text-xs text-[#6B6560] uppercase tracking-[0.1em] mb-1">Member ID</p>
                <p className="text-[#C85C2D] font-mono font-semibold text-sm">{member.member_code}</p>
              </div>
            </div>

            {/* Plan perks */}
            <div>
              <p className="text-xs text-[#6B6560] uppercase tracking-[0.1em] mb-3">Your Plan Includes</p>
              <ul className="space-y-2">
                {(planPerks[member.plan_type] || []).map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-sm text-[#1C1A17]">
                    <span className="w-4 h-4 rounded-full bg-[#C85C2D]/10 border border-[#C85C2D]/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-[#C85C2D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
          <div className="bg-white border border-[#E8E3D9] rounded-2xl p-6 flex flex-col items-center justify-center">
            <p className="text-xs text-[#6B6560] uppercase tracking-[0.1em] mb-4">Gym Check-In QR</p>
            <MemberQRCode memberCode={member.member_code} />
            <p className="text-xs text-[#6B6560] mt-4 text-center">
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
              color: member.status === 'active' ? 'text-[#1F3D2B]' : 'text-red-600',
            },
            {
              label: 'Plan Type',
              value: member.plan_type ? member.plan_type.charAt(0).toUpperCase() + member.plan_type.slice(1) : '—',
              color: 'text-[#C85C2D]',
            },
            {
              label: 'Next Billing',
              value: periodEndLabel,
              color: 'text-[#1C1A17]',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-[#E8E3D9] rounded-xl p-4 text-center">
              <p className="text-xs text-[#6B6560] uppercase tracking-[0.1em] mb-1">{label}</p>
              <p className={`font-medium text-xs sm:text-sm ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="mt-4 flex gap-3 flex-wrap">
          <Link
            href="/dashboard/payments"
            className="flex items-center gap-1.5 text-xs text-[#6B6560] hover:text-[#1C1A17] transition border border-[#E8E3D9] rounded-lg px-3 py-2 hover:bg-white"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            View payment history
          </Link>
          <Link
            href="/pricing"
            className="flex items-center gap-1.5 text-xs text-[#6B6560] hover:text-[#1C1A17] transition border border-[#E8E3D9] rounded-lg px-3 py-2 hover:bg-white"
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
