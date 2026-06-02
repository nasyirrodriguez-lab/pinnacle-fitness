import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MemberQRCode from '@/components/MemberQRCode'
import LogoutButton from '@/components/LogoutButton'
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
          <form action="/auth/signout" method="post">
            <button className="mt-4 text-orange-400 text-sm hover:underline">Sign out</button>
          </form>
        </div>
      </div>
    )
  }

  const joinDate = new Date(member.join_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

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
          <div className="flex items-center gap-4">
            {member.role === 'admin' && (
              <a
                href="/admin"
                className="text-xs text-orange-400 hover:text-orange-300 font-medium border border-orange-500/30 px-3 py-1.5 rounded-lg hover:bg-orange-500/10 transition"
              >
                Admin Panel
              </a>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Welcome */}
        <div className="mb-10">
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
            { label: 'Plan Status', value: 'Active', color: 'text-green-400' },
            { label: 'Plan Type', value: member.plan_type.charAt(0).toUpperCase() + member.plan_type.slice(1), color: 'text-orange-400' },
            { label: 'Next Billing', value: 'Auto-renews monthly', color: 'text-zinc-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
              <p className={`font-semibold text-sm ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
