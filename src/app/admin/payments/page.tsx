import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'
import { cn } from '@/lib/utils'
import { fmtAstDate } from '@/lib/time/ast'
import AdminRefundButton from '@/components/admin/admin-refund-button'
import AdminPaymentDate from '@/components/admin/admin-payment-date'
import AdminVerifyWamButton from '@/components/admin/admin-verify-wam-button'
import AdminConfirmCashButton from '@/components/admin/admin-confirm-cash-button'
import ReconcileButton from '@/components/admin/reconcile-button'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    status?: string
    kind?: string
    page?: string
  }>
}

interface PaymentRow {
  id: string
  amountCents: number
  currency: string
  status: string
  kind: string
  paidAt: string | null
  createdAt: string
  wamPaymentId: string | null
  paymentMethod: string | null
  wamReportsPaid: boolean
  userId: string | null
  userName: string | null
  userEmail: string | null
}

const PAGE_LIMIT = 100

async function loadPayments(args: {
  status?: string
  kind?: string
  page: number
}): Promise<{ rows: PaymentRow[]; totalCount: number }> {
  const admin = createAdminClient()
  // Explicit FK hint: payments has TWO FKs to profiles (user_id and
  // recorded_by since the manual-payment work), and PostgREST can't
  // auto-pick one. Without `!payments_user_id_fkey` the join silently
  // errors and we return an empty list.
  let query = admin
    .from('payments')
    .select(
      'id, amount_cents, currency, status, kind, paid_at, created_at, wam_payment_id, payment_method, metadata, user_id, profiles!payments_user_id_fkey(full_name, email)',
      { count: 'exact' }
    )

  if (args.status) query = query.eq('status', args.status)
  if (args.kind) query = query.eq('kind', args.kind)

  const offset = (args.page - 1) * PAGE_LIMIT
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_LIMIT - 1)

  const { data, error, count } = await query
  if (error || !data) return { rows: [], totalCount: 0 }

  const rows = (data as Record<string, unknown>[]).map((raw) => {
    const profileRaw = raw.profiles as
      | { full_name?: string; email?: string }
      | { full_name?: string; email?: string }[]
      | null
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
    return {
      id: raw.id as string,
      amountCents: raw.amount_cents as number,
      currency: raw.currency as string,
      status: raw.status as string,
      kind: raw.kind as string,
      paidAt: (raw.paid_at as string | null) ?? null,
      createdAt: raw.created_at as string,
      wamPaymentId: (raw.wam_payment_id as string | null) ?? null,
      paymentMethod: (raw.payment_method as string | null) ?? null,
      wamReportsPaid: Boolean(
        (raw.metadata as Record<string, unknown> | null)?.wamReportsPaidAt
      ),
      userId: (raw.user_id as string | null) ?? null,
      userName: profile?.full_name ?? null,
      userEmail: profile?.email ?? null,
    }
  })

  // Sort by the date the table displays (paid_at when set, otherwise
  // created_at) so rows read chronologically. Fetch sorts by created_at
  // — reconciled payments get paid_at backfilled later, which makes the
  // displayed dates look jumbled without this re-sort.
  rows.sort(
    (a, b) =>
      new Date(b.paidAt ?? b.createdAt).getTime() -
      new Date(a.paidAt ?? a.createdAt).getTime()
  )

  return { rows, totalCount: count ?? rows.length }
}

// True total across the WHOLE filtered set, not just the visible page.
async function loadSucceededTotalCents(kind?: string): Promise<number> {
  const admin = createAdminClient()
  let query = admin
    .from('payments')
    .select('amount_cents')
    .eq('status', 'succeeded')
  if (kind) query = query.eq('kind', kind)
  const { data } = await query.limit(20000)
  return ((data as { amount_cents: number }[] | null) ?? []).reduce(
    (sum, r) => sum + (r.amount_cents ?? 0),
    0
  )
}

const fmtDate = fmtAstDate

function fmtPrice(cents: number, currency: string): string {
  return `${currency} $${(cents / 100).toFixed(0)}`
}

function FilterTab({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'px-3 py-1 text-sm font-medium rounded transition',
        active
          ? 'bg-white text-neutral-900 shadow-sm'
          : 'text-neutral-600 hover:text-neutral-900'
      )}
    >
      {label}
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    succeeded: 'bg-green-100 text-green-900',
    pending: 'bg-orange-100 text-orange-900',
    failed: 'bg-red-100 text-red-900',
    refunded: 'bg-neutral-200 text-neutral-700',
    cancelled: 'bg-neutral-200 text-neutral-600',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded',
        styles[status] ?? 'bg-neutral-100 text-neutral-700'
      )}
    >
      {status}
    </span>
  )
}

async function loadPendingWamOnlineCount(): Promise<number> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('payment_method', 'wam_online')
  return count ?? 0
}

export default async function AdminPaymentsPage({ searchParams }: PageProps) {
  const { status, kind, page: pageParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const [{ rows, totalCount }, pendingWamCount, totalSucceededCents] =
    await Promise.all([
      loadPayments({ status, kind, page }),
      loadPendingWamOnlineCount(),
      loadSucceededTotalCents(kind),
    ])

  const buildHref = (
    newStatus?: string | null,
    newKind?: string | null,
    newPage?: number
  ) => {
    const params = new URLSearchParams()
    const s = newStatus !== undefined ? newStatus : status
    const k = newKind !== undefined ? newKind : kind
    if (s) params.set('status', s)
    if (k) params.set('kind', k)
    // Changing a filter resets to page 1; only explicit paging keeps it.
    if (newPage && newPage > 1) params.set('page', String(newPage))
    const qs = params.toString()
    return qs ? `/admin/payments?${qs}` : '/admin/payments'
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_LIMIT))
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1
  const rangeEnd = Math.min(page * PAGE_LIMIT, totalCount)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl mb-1">Payments</h1>
          <p className="text-neutral-600">
            {totalCount} payment{totalCount === 1 ? '' : 's'}
            {totalCount > PAGE_LIMIT && (
              <>
                {' '}
                · showing {rangeStart}–{rangeEnd}
              </>
            )}{' '}
            · Total successful{kind ? ` (${kind})` : ''}:{' '}
            {fmtPrice(totalSucceededCents, rows[0]?.currency ?? 'TTD')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/admin/passes/influencer-batch"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-neutral-300 rounded-md hover:bg-neutral-50"
          >
            Influencer batch
          </Link>
          <Link
            href="/admin/payments/new"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-darkBlue-900 text-white rounded-md hover:bg-darkBlue-800"
          >
            Record payment
          </Link>
        </div>
      </div>

      {pendingWamCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-orange-900 mb-1">
            {pendingWamCount} Wam payment
            {pendingWamCount === 1 ? '' : 's'} awaiting confirmation
          </p>
          <p className="text-xs text-orange-800 mb-3">
            Only Wam&apos;s confirmation webhook marks a payment paid
            automatically. This check clears out failed and abandoned attempts,
            and highlights payments Wam reports as paid so you can confirm each
            one with its &ldquo;Wam says paid&rdquo; button below.
          </p>
          <ReconcileButton pendingCount={pendingWamCount} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="inline-flex gap-1 p-1 bg-neutral-100 rounded-md">
          <FilterTab
            href={buildHref(null, undefined)}
            label="All"
            active={!status}
          />
          <FilterTab
            href={buildHref('succeeded', undefined)}
            label="Succeeded"
            active={status === 'succeeded'}
          />
          <FilterTab
            href={buildHref('pending', undefined)}
            label="Pending"
            active={status === 'pending'}
          />
          <FilterTab
            href={buildHref('failed', undefined)}
            label="Failed"
            active={status === 'failed'}
          />
          <FilterTab
            href={buildHref('refunded', undefined)}
            label="Refunded"
            active={status === 'refunded'}
          />
        </div>
        <div className="inline-flex gap-1 p-1 bg-neutral-100 rounded-md">
          <FilterTab
            href={buildHref(undefined, null)}
            label="All kinds"
            active={!kind}
          />
          <FilterTab
            href={buildHref(undefined, 'pass')}
            label="Pass"
            active={kind === 'pass'}
          />
          <FilterTab
            href={buildHref(undefined, 'booking')}
            label="Booking"
            active={kind === 'booking'}
          />
          <FilterTab
            href={buildHref(undefined, 'subscription')}
            label="Subscription"
            active={kind === 'subscription'}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center text-neutral-500">
          No payments match these filters.
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 hidden lg:table-cell">Wam ID</th>
                <th className="px-4 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50 transition">
                  <td className="px-4 py-3 text-sm">
                    <AdminPaymentDate
                      paymentId={p.id}
                      dateLabel={fmtDate(p.paidAt ?? p.createdAt)}
                      currentIso={p.paidAt ?? p.createdAt}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {p.userId ? (
                      <Link
                        href={`/admin/members/${p.userId}`}
                        className="font-medium hover:text-darkBlue-900"
                      >
                        {p.userName ?? p.userEmail ?? '—'}
                      </Link>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{p.kind}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    {fmtPrice(p.amountCents, p.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500 font-mono hidden lg:table-cell">
                    {p.wamPaymentId ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.status === 'succeeded' && (
                      <AdminRefundButton
                        paymentId={p.id}
                        amountLabel={fmtPrice(p.amountCents, p.currency)}
                        wamPaymentId={p.wamPaymentId}
                      />
                    )}
                    {p.status === 'pending' &&
                      p.paymentMethod === 'wam_online' &&
                      p.wamPaymentId && (
                        <AdminVerifyWamButton
                          paymentId={p.id}
                          wamReportsPaid={p.wamReportsPaid}
                        />
                      )}
                    {p.status === 'pending' && p.paymentMethod === 'cash' && (
                      <AdminConfirmCashButton
                        paymentId={p.id}
                        amountLabel={fmtPrice(p.amountCents, p.currency)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link
              href={buildHref(undefined, undefined, page - 1)}
              className="px-3 py-1.5 text-sm font-medium border border-neutral-300 rounded-md hover:bg-neutral-50"
            >
              ← Newer
            </Link>
          ) : (
            <span className="px-3 py-1.5 text-sm text-neutral-300 border border-neutral-200 rounded-md">
              ← Newer
            </span>
          )}
          <span className="text-sm text-neutral-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref(undefined, undefined, page + 1)}
              className="px-3 py-1.5 text-sm font-medium border border-neutral-300 rounded-md hover:bg-neutral-50"
            >
              Older →
            </Link>
          ) : (
            <span className="px-3 py-1.5 text-sm text-neutral-300 border border-neutral-200 rounded-md">
              Older →
            </span>
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-neutral-500">
        Refunds are processed in the Wam dashboard. After issuing a refund,
        update the payment status to <code>refunded</code> in the Supabase SQL
        editor — or wire that into a server action when needed.
      </p>
    </div>
  )
}
