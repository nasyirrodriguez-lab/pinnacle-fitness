import type { OverviewStats } from '@/lib/types'

const planPrice: Record<string, number> = { basic: 29, premium: 59, elite: 99 }

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-2 text-3xl font-black ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-600">{sub}</p>}
    </div>
  )
}

export default function OverviewSection({ stats }: { stats: OverviewStats }) {
  const mrr = Object.entries(stats.planBreakdown).reduce(
    (sum, [plan, count]) => sum + (planPrice[plan] ?? 0) * count,
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Overview</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Snapshot of today's activity and membership health</p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Members"
          value={stats.totalMembers}
          sub={`${stats.suspendedMembers} suspended`}
        />
        <StatCard
          label="Active Memberships"
          value={stats.activeMembers}
          accent="text-green-400"
          sub={`${Math.round((stats.activeMembers / Math.max(stats.totalMembers, 1)) * 100)}% of total`}
        />
        <StatCard
          label="Revenue This Month"
          value={`$${stats.revenueThisMonth.toLocaleString()}`}
          accent="text-orange-400"
          sub={`MRR est. $${mrr.toLocaleString()}`}
        />
        <StatCard
          label="Check-Ins Today"
          value={stats.checkInsToday}
          accent="text-blue-400"
          sub="all methods"
        />
      </div>

      {/* Plan breakdown */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-5">Plan Breakdown</h3>
        <div className="space-y-3">
          {(
            [
              { slug: 'basic', label: 'Basic', color: 'bg-zinc-500', price: 29 },
              { slug: 'premium', label: 'Premium', color: 'bg-blue-500', price: 59 },
              { slug: 'elite', label: 'Elite', color: 'bg-orange-500', price: 99 },
            ] as const
          ).map(({ slug, label, color, price }) => {
            const count = stats.planBreakdown[slug] ?? 0
            const pct = stats.totalMembers > 0 ? (count / stats.totalMembers) * 100 : 0
            return (
              <div key={slug}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-zinc-300 font-medium">{label}</span>
                  <span className="text-zinc-500">
                    {count} members · ${(count * price).toLocaleString()}/mo
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800">
                  <div
                    className={`h-2 rounded-full ${color} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
