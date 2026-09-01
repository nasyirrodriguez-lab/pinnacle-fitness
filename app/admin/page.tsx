import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import LogoutButton from '@/components/LogoutButton'
import AdminDashboard from '@/components/admin/AdminDashboard'
import type { Member, CheckIn, Payment, OverviewStats } from '@/lib/types'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const adminClient = createAdminClient()
  const { data: caller } = await adminClient.from('profiles').select('role').eq('id', user.id).single()
  if (!caller || caller.role !== 'admin') redirect('/dashboard')

  const today = new Date().toISOString().split('T')[0]
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [membersRes, profilesRes, authUsersRes, checkInsRes, paymentsRes, freeTrialRes] = await Promise.all([
    adminClient.from('members').select('*').order('created_at', { ascending: false }),
    adminClient.from('profiles').select('id, full_name'),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('check_ins').select('*').gte('checked_in_at', `${today}T00:00:00`).order('checked_in_at', { ascending: false }),
    supabase.from('payments').select('*').order('paid_at', { ascending: false }),
    adminClient.from('free_trial_bookings').select('*').order('created_at', { ascending: false }),
  ])

  const profileMap = Object.fromEntries(
    (profilesRes.data ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? ''])
  )
  const userEmailMap = Object.fromEntries(
    (authUsersRes.data?.users ?? []).map((u) => [u.id, u.email ?? ''])
  )

  const members = ((membersRes.data ?? []) as Member[]).map((m) => ({
    ...m,
    name: profileMap[m.user_id] || 'Unknown',
    email: userEmailMap[m.user_id] || '',
    join_date: m.created_at,
  })) as Member[]

  const checkIns = (checkInsRes.data ?? []) as CheckIn[]
  const payments = (paymentsRes.data ?? []) as Payment[]
  const freeTrialBookings = freeTrialRes.data ?? []

  const revenueThisMonth = payments
    .filter((p) => p.status === 'paid' && p.paid_at >= monthStart)
    .reduce((sum, p) => sum + p.amount, 0)

  const planBreakdown = members.reduce(
    (acc, m) => { acc[m.plan_type] = (acc[m.plan_type] ?? 0) + 1; return acc },
    { basic: 0, premium: 0, elite: 0 }
  )

  const stats: OverviewStats = {
    totalMembers: members.length,
    activeMembers: members.filter((m) => (m.status ?? 'active') === 'active').length,
    suspendedMembers: members.filter((m) => m.status === 'suspended').length,
    revenueThisMonth,
    checkInsToday: checkIns.length,
    planBreakdown,
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500">
              <span className="text-xs font-black text-white">P</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/PHOTO-2026-08-25-06-14-47.jpg" alt="Pinnacle Fitness" style={{ height: 32, filter: 'brightness(0) invert(1)' }} className="hidden sm:block" />
            <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-medium">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-zinc-600 hidden sm:block">Signed in as {user.email}</span>
            <a href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-300 transition">My Dashboard</a>
            <LogoutButton />
          </div>
        </div>
      </header>

      <AdminDashboard
        stats={stats}
        members={members}
        checkIns={checkIns}
        payments={payments}
        freeTrialBookings={freeTrialBookings}
      />
    </div>
  )
}
