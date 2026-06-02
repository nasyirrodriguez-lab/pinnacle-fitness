import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import type { Member } from '@/lib/types'

const planBadge: Record<string, string> = {
  basic: 'bg-zinc-700 text-zinc-300',
  premium: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  elite: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth')

  const { data: currentMember } = await supabase
    .from('members')
    .select('role')
    .eq('user_id', user.id)
    .single<Pick<Member, 'role'>>()

  if (!currentMember || currentMember.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: members } = await supabase
    .from('members')
    .select('*')
    .order('join_date', { ascending: false })

  const allMembers = (members ?? []) as Member[]

  const counts = allMembers.reduce(
    (acc, m) => { acc[m.plan_type] = (acc[m.plan_type] || 0) + 1; return acc },
    {} as Record<string, number>
  )

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-orange-500 rounded-md flex items-center justify-center">
              <span className="text-white font-black text-xs">P</span>
            </div>
            <span className="text-white font-bold tracking-tight">Pinnacle Fitness</span>
            <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-medium">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
              My Dashboard
            </a>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Member Management</h1>
          <p className="text-zinc-500 mt-1">All registered Pinnacle Fitness members</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Members', value: allMembers.length, color: 'text-white' },
            { label: 'Basic', value: counts.basic ?? 0, color: 'text-zinc-300' },
            { label: 'Premium', value: counts.premium ?? 0, color: 'text-blue-400' },
            { label: 'Elite', value: counts.elite ?? 0, color: 'text-orange-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">All Members</h2>
            <span className="text-xs text-zinc-600">{allMembers.length} total</span>
          </div>

          {allMembers.length === 0 ? (
            <div className="py-16 text-center text-zinc-600">No members yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Member ID', 'Name', 'Email', 'Plan', 'Role', 'Joined'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {allMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-orange-400 text-xs">{m.member_id}</td>
                      <td className="px-6 py-4 text-white font-medium">{m.name}</td>
                      <td className="px-6 py-4 text-zinc-400">{m.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${planBadge[m.plan_type]}`}>
                          {m.plan_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium ${m.role === 'admin' ? 'text-orange-400' : 'text-zinc-500'}`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-500 text-xs">
                        {new Date(m.join_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
