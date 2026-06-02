import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import RenewBanner from '@/components/dashboard/RenewBanner'
import BillingPortalButton from '@/components/dashboard/BillingPortalButton'
import LogoutButton from '@/components/LogoutButton'
import type { Member, Payment } from '@/lib/types'

const statusBadge: Record<string, string> = {
  paid: 'bg-green-500/15 text-green-400 border border-green-500/25',
  failed: 'bg-red-500/15 text-red-400 border border-red-500/25',
  refunded: 'bg-zinc-700 text-zinc-400',
}

const planBadge: Record<string, string> = {
  basic: 'bg-zinc-700 text-zinc-300',
  premium: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  elite: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; plan?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const [memberRes, paymentsRes] = await Promise.all([
    supabase.from('members').select('*').eq('user_id', user.id).single<Member>(),
    supabase
      .from('payments')
      .select('*')
      .eq('member_id',
        // need member id — fetch it first
        (await supabase.from('members').select('id').eq('user_id', user.id).single()).data?.id ?? ''
      )
      .order('paid_at', { ascending: false }),
  ])

  const member = memberRes.data
  const payments = (paymentsRes.data ?? []) as Payment[]

  if (!member) redirect('/auth')

  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + p.amount, 0)

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500">
                <span className="text-xs font-black text-white">P</span>
              </div>
              <span className="font-bold text-white tracking-tight hidden sm:block">Pinnacle Fitness</span>
            </Link>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
              Dashboard
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10">
        {/* Success / canceled banners */}
        {params.success && (
          <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-4 flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-sm font-bold text-green-300">Payment successful!</p>
              <p className="text-xs text-green-400/80 mt-0.5">
                Your {params.plan ? `${params.plan.charAt(0).toUpperCase() + params.plan.slice(1)} ` : ''}membership is now active. Welcome to Pinnacle!
              </p>
            </div>
          </div>
        )}
        {params.canceled && (
          <div className="mb-6 rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-4">
            <p className="text-sm text-zinc-400">Payment was canceled. Your plan has not changed.</p>
          </div>
        )}

        {/* Expiry banner */}
        {member.current_period_end && (
          <div className="mb-6">
            <RenewBanner periodEnd={member.current_period_end} planSlug={member.plan_type} />
          </div>
        )}

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Payment History</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {payments.length} payment{payments.length !== 1 ? 's' : ''} ·{' '}
              <span className="text-green-400">${totalPaid.toFixed(2)} total paid</span>
            </p>
          </div>
          <BillingPortalButton />
        </div>

        {/* Membership status card */}
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            {
              label: 'Current Plan',
              value: member.plan_type.charAt(0).toUpperCase() + member.plan_type.slice(1),
              color: 'text-orange-400',
            },
            {
              label: 'Status',
              value: member.status === 'active' ? 'Active' : 'Suspended',
              color: member.status === 'active' ? 'text-green-400' : 'text-red-400',
            },
            {
              label: 'Next Billing',
              value: member.current_period_end
                ? new Date(member.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—',
              color: 'text-zinc-300',
            },
            {
              label: 'Total Paid',
              value: `$${totalPaid.toFixed(2)}`,
              color: 'text-zinc-300',
            },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className="text-xs text-zinc-600 uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-sm font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Payments table */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-300">Transactions</h2>
          </div>

          {payments.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-zinc-600 text-sm">No payments yet.</p>
              <Link
                href="/pricing"
                className="mt-4 inline-block rounded-lg bg-orange-500 px-5 py-2 text-sm font-bold text-white hover:bg-orange-400 transition-colors"
              >
                View Plans →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-800/40">
                    {['Plan', 'Amount', 'Date', 'Status', 'Invoice'].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${planBadge[p.plan_type]}`}>
                          {p.plan_type}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono font-semibold text-white">
                        ${p.amount.toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-zinc-500 text-xs whitespace-nowrap">
                        {new Date(p.paid_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusBadge[p.status]}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {p.invoice_url ? (
                          <a
                            href={p.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                            Download
                          </a>
                        ) : (
                          <span className="text-xs text-zinc-700">—</span>
                        )}
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
