import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createAdminClient } from '@/utils/supabase/admin'
import { fmtAstDate } from '@/lib/time/ast'
import type { InvoiceLineItem } from '@/lib/invoices/create'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Invoice — Pinnacle Fitness',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ id: string }>
}

const KIND_LABEL: Record<string, string> = {
  membership: 'Membership',
  pack: 'Sessions pack',
  shop: 'Shop',
  other: 'Services',
}

function fmtTtd(cents: number): string {
  return `TTD $${(cents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`
}

export default async function InvoicePage({ params }: PageProps) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  const { id } = await params

  const admin = createAdminClient()
  const { data } = await admin
    .from('invoices')
    .select(
      'id, number, user_id, kind, line_items, amount_cents, currency, period_label, due_at, created_at, payments(status), profiles!invoices_user_id_fkey(full_name, email, company)'
    )
    .eq('id', id)
    .maybeSingle()
  if (!data) notFound()

  const raw = data as Record<string, unknown>
  // Members see their own; admins see all.
  if (raw.user_id !== user.id && user.role !== 'admin') notFound()

  const payRaw = raw.payments as
    | { status?: string }
    | { status?: string }[]
    | null
  const payment = Array.isArray(payRaw) ? (payRaw[0] ?? null) : payRaw
  const paid = payment?.status === 'succeeded'
  const profRaw = raw.profiles as
    | { full_name?: string | null; email?: string; company?: string | null }
    | { full_name?: string | null; email?: string; company?: string | null }[]
    | null
  const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
  const lineItems = (
    Array.isArray(raw.line_items) ? raw.line_items : []
  ) as InvoiceLineItem[]

  return (
    <div className="max-w-2xl">
      <div className="print:hidden mb-4 flex items-center justify-between">
        <Link
          href="/dashboard/invoices"
          className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
        >
          <ChevronLeft size={16} />
          Invoices
        </Link>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-8 md:p-10 print:border-0">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="font-heading text-2xl tracking-tight">THE WORX</p>
            <p className="text-xs text-neutral-500 leading-relaxed mt-1">
              1 Luis Street
              <br />
              Port of Spain, Trinidad and Tobago
              <br />
              hello@pinnaclefitness.app
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Invoice
            </p>
            <p className="font-heading text-xl">{String(raw.number)}</p>
            <span
              className={
                paid
                  ? 'mt-2 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-lime-100 text-lime-900'
                  : 'mt-2 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-900'
              }
            >
              {paid ? 'PAID' : 'UNPAID'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm mb-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
              Billed to
            </p>
            <p className="font-medium">
              {profile?.full_name?.trim() || profile?.email}
            </p>
            {profile?.company && (
              <p className="text-neutral-600">{profile.company}</p>
            )}
            <p className="text-neutral-600">{profile?.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
              Details
            </p>
            <p>{KIND_LABEL[String(raw.kind)] ?? 'Services'}</p>
            {typeof raw.period_label === 'string' && raw.period_label && (
              <p className="text-neutral-600">Period: {raw.period_label}</p>
            )}
            <p className="text-neutral-600">
              Issued {fmtAstDate(String(raw.created_at))}
            </p>
            {typeof raw.due_at === 'string' && raw.due_at && (
              <p className="text-neutral-600">Due {fmtAstDate(raw.due_at)}</p>
            )}
          </div>
        </div>

        <table className="w-full mb-8">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 border-b border-neutral-200">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lineItems.map((item, i) => (
              <tr key={i}>
                <td className="py-3 text-sm">{item.label}</td>
                <td className="py-3 text-sm text-right whitespace-nowrap">
                  {fmtTtd(item.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-300">
              <td className="py-3 font-heading">Total due</td>
              <td className="py-3 font-heading text-right whitespace-nowrap">
                {fmtTtd(Number(raw.amount_cents))}
              </td>
            </tr>
          </tfoot>
        </table>

        {!paid && (
          <p className="text-sm text-neutral-600 print:hidden">
            Pay with the button in your invoice email, or settle at the front
            desk (cash or card) quoting invoice {String(raw.number)}.
          </p>
        )}
        <p className="text-xs text-neutral-400 mt-6">
          Pinnacle Fitness · pinnaclefitness.app · Thank you for building with
          us.
        </p>
      </div>
    </div>
  )
}
