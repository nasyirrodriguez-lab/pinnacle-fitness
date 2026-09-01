import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import RenewBanner from '@/components/dashboard/RenewBanner'
import BillingPortalButton from '@/components/dashboard/BillingPortalButton'
import LogoutButton from '@/components/LogoutButton'
import type { Member, Payment } from '@/lib/types'

const statusBadge: Record<string, string> = {
  paid: 'bg-green-50 text-green-700 border border-green-200',
  failed: 'bg-red-50 text-red-700 border border-red-200',
  refunded: 'bg-[#CCC8C0] text-[#6B6560]',
}

const planBadge: Record<string, string> = {
  basic: 'bg-[#CCC8C0] text-[#6B6560]',
  premium: 'bg-[#1F3D2B]/10 text-[#1F3D2B] border border-[#1F3D2B]/20',
  elite: 'bg-[#3A3733]/10 text-[#3A3733] border border-[#3A3733]/20',
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
    <div className="min-h-screen bg-[#E8E4DC]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#CCC8C0] bg-[#E8E4DC]/95 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-baseline gap-1.5 group">
              <span className="font-serif italic text-xl text-[#3A3733]">Pinnacle</span>
              <span className="text-xs tracking-[0.15em] uppercase font-medium text-[#6B6560]">GYM</span>
            </Link>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xs text-[#6B6560] hover:text-[#3A3733] transition">
              Dashboard
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10">
        {/* Success / canceled banners */}
        {params.success && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-sm font-medium text-green-700">Payment successful!</p>
              <p className="text-xs text-green-600 mt-0.5">
                Your {params.plan ? `${params.plan.charAt(0).toUpperCase() + params.plan.slice(1)} ` : ''}membership is now active. Welcome to Pinnacle!
              </p>
            </div>
          </div>
        )}
        {params.canceled && (
          <div className="mb-6 rounded-xl border border-[#CCC8C0] bg-white px-5 py-4">
            <p className="text-sm text-[#6B6560]">Payment was canceled. Your plan has not changed.</p>
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
            <h1 className="font-serif text-2xl text-[#3A3733]">Payment History</h1>
            <p className="text-sm text-[#6B6560] mt-0.5">
              {payments.length} payment{payments.length !== 1 ? 's' : ''} ·{' '}
              <span className="text-[#1F3D2B] font-medium">${totalPaid.toFixed(2)} total paid</span>
            </p>
          </div>
          <BillingPortalButton />
        </div>

        {/* Membership status card */}
        <div className="mb-6 rounded-2xl border border-[#CCC8C0] bg-white p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            {
              label: 'Current Plan',
              value: member.plan_type.charAt(0).toUpperCase() + member.plan_type.slice(1),
              color: 'text-[#3A3733]',
            },
            {
              label: 'Status',
              value: member.status === 'active' ? 'Active' : 'Suspended',
              color: member.status === 'active' ? 'text-[#1F3D2B]' : 'text-red-600',
            },
            {
              label: 'Next Billing',
              value: member.current_period_end
                ? new Date(member.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—',
              color: 'text-[#3A3733]',
            },
            {
              label: 'Total Paid',
              value: `$${totalPaid.toFixed(2)}`,
              color: 'text-[#3A3733]',
            },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className="text-xs text-[#6B6560] uppercase tracking-[0.1em] mb-1">{label}</p>
              <p className={`text-sm font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Payments table */}
        <div className="rounded-2xl border border-[#CCC8C0] bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-[#CCC8C0]">
            <h2 className="text-sm font-medium text-[#3A3733]">Transactions</h2>
          </div>

          {payments.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[#6B6560] text-sm">No payments yet.</p>
              <Link
                href="/pricing"
                className="mt-4 inline-block rounded-full bg-[#1F3D2B] px-7 py-3 text-sm font-medium text-white hover:bg-[#172e1f] transition-colors"
              >
                View Plans →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#CCC8C0] bg-[#E8E4DC]/50">
                    {['Plan', 'Amount', 'Date', 'Status', 'Invoice'].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-medium text-[#6B6560] uppercase tracking-[0.1em] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CCC8C0]">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-[#E8E4DC]/40 transition-colors">
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wide ${planBadge[p.plan_type]}`}>
                          {p.plan_type}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono font-semibold text-[#3A3733]">
                        ${p.amount.toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-[#6B6560] text-xs whitespace-nowrap">
                        {new Date(p.paid_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusBadge[p.status]}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {p.invoice_url ? (
                          <a
                            href={p.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-[#3A3733] hover:text-[#2a2825] transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                            Download
                          </a>
                        ) : (
                          <span className="text-xs text-[#CCC8C0]">—</span>
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
