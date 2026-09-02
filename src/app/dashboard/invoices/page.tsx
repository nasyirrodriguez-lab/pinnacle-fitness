import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Receipt, ArrowRight, CheckCircle2 } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createClient } from '@/utils/supabase/server'
import type { InvoiceLineItem } from '@/lib/invoices/create'
import { cn } from '@/lib/utils'
import { fmtAstDate } from '@/lib/time/ast'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Invoices — The Worx',
  robots: { index: false, follow: false },
}

interface PaymentRow {
  id: string
  amountCents: number
  currency: string
  status: string
  kind: string
  paidAt: string | null
  createdAt: string
  metadata: Record<string, unknown>
}

async function loadPayments(userId: string): Promise<PaymentRow[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data, error } = await supabase
    .from('payments')
    .select(
      'id, amount_cents, currency, status, kind, paid_at, created_at, metadata'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !data) return []
  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    amountCents: row.amount_cents as number,
    currency: row.currency as string,
    status: row.status as string,
    kind: row.kind as string,
    paidAt: (row.paid_at as string | null) ?? null,
    createdAt: row.created_at as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }))
}

interface InvoiceListRow {
  id: string
  number: string
  amountCents: number
  periodLabel: string | null
  createdAt: string
  paid: boolean
  lineItems: InvoiceLineItem[]
}

async function loadInvoices(userId: string): Promise<InvoiceListRow[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data } = await supabase
    .from('invoices')
    .select(
      'id, number, amount_cents, period_label, created_at, line_items, payments(status)'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
    const payRaw = r.payments as
      | { status?: string }
      | { status?: string }[]
      | null
    const payment = Array.isArray(payRaw) ? (payRaw[0] ?? null) : payRaw
    return {
      id: r.id as string,
      number: r.number as string,
      amountCents: r.amount_cents as number,
      periodLabel: (r.period_label as string | null) ?? null,
      createdAt: r.created_at as string,
      paid: payment?.status === 'succeeded',
      lineItems: Array.isArray(r.line_items)
        ? (r.line_items as InvoiceLineItem[])
        : [],
    }
  })
}

function fmtPrice(cents: number, currency: string): string {
  return `${currency} $${(cents / 100).toFixed(0)}`
}

const fmtDate = fmtAstDate

function kindLabel(kind: string): string {
  switch (kind) {
    case 'pass':
      return 'Day pass'
    case 'booking':
      return 'Room booking'
    case 'subscription':
      return 'Monthly plan'
    case 'one_time':
      return 'One-time charge'
    default:
      return kind
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    succeeded: 'bg-green-100 text-green-900',
    pending: 'bg-orange-100 text-orange-900',
    failed: 'bg-red-100 text-red-900',
    refunded: 'bg-neutral-200 text-neutral-700',
    cancelled: 'bg-neutral-200 text-neutral-600',
  }
  const label: Record<string, string> = {
    succeeded: 'Paid',
    pending: 'Pending',
    failed: 'Failed',
    refunded: 'Refunded',
    cancelled: 'Cancelled',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded',
        styles[status] ?? 'bg-neutral-100 text-neutral-700'
      )}
    >
      {label[status] ?? status}
    </span>
  )
}

export default async function InvoicesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const [payments, invoices] = await Promise.all([
    loadPayments(user.id),
    loadInvoices(user.id),
  ])
  const paid = payments.filter((p) => p.status === 'succeeded')
  const totalPaidCents = paid.reduce((sum, p) => sum + p.amountCents, 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Invoices</h1>
        <p className="text-neutral-600">
          Your payment history. Receipts are generated for every successful
          charge.
        </p>
      </div>

      {invoices.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="font-heading text-lg">Your invoices</h2>
          </div>
          <ul className="divide-y divide-neutral-100">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/dashboard/invoices/${inv.id}`}
                  className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-neutral-50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {inv.number}
                      {inv.periodLabel && (
                        <span className="ml-2 text-xs font-normal text-neutral-500">
                          {inv.periodLabel}
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {fmtDate(inv.createdAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium">
                      {fmtPrice(inv.amountCents, 'TTD')}
                    </span>
                    <span
                      className={
                        inv.paid
                          ? 'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-lime-100 text-lime-900'
                          : 'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-900'
                      }
                    >
                      {inv.paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {paid.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Lifetime paid
              </p>
              <p className="font-heading text-2xl">
                {fmtPrice(totalPaidCents, paid[0].currency)}
              </p>
              <p className="text-sm text-neutral-500 mt-1">
                {paid.length}{' '}
                {paid.length === 1
                  ? 'successful payment'
                  : 'successful payments'}
              </p>
            </div>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
          <Receipt size={32} className="mx-auto mb-3 text-neutral-400" />
          <p className="font-medium mb-1">No invoices yet</p>
          <p className="text-sm text-neutral-500 mb-6">
            Your receipts will appear here after your first payment.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 text-sm font-medium text-turquoise-700 hover:text-turquoise-900"
          >
            See plans &amp; passes
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50 transition">
                  <td className="px-4 py-3 text-sm text-neutral-700">
                    {fmtDate(p.paidAt ?? p.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm">{kindLabel(p.kind)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    {fmtPrice(p.amountCents, p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-neutral-500">
        Need a formal receipt or VAT invoice? Email{' '}
        <a
          href="mailto:team@theworx.io"
          className="text-turquoise-700 underline"
        >
          team@theworx.io
        </a>{' '}
        with your payment date.
      </p>
    </div>
  )
}
