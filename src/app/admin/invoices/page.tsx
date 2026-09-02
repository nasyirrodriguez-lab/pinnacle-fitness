import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'
import { fmtAstDate } from '@/lib/time/ast'
import {
  AdminInvoiceForm,
  RunMonthlyInvoicingButton,
} from '@/components/admin/admin-invoice-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Invoices — Admin',
}

interface InvoiceRow {
  id: string
  number: string
  kind: string
  amountCents: number
  periodLabel: string | null
  createdAt: string
  paid: boolean
  memberName: string
  userId: string
}

const KIND_LABEL: Record<string, string> = {
  membership: 'Membership',
  pack: 'Pack',
  shop: 'Shop',
  other: 'Other',
}

async function loadInvoices(): Promise<InvoiceRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('invoices')
    .select(
      'id, number, kind, amount_cents, period_label, created_at, user_id, payments(status), profiles!invoices_user_id_fkey(full_name, email)'
    )
    .order('created_at', { ascending: false })
    .limit(100)
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
    const payRaw = r.payments as
      | { status?: string }
      | { status?: string }[]
      | null
    const payment = Array.isArray(payRaw) ? (payRaw[0] ?? null) : payRaw
    const profRaw = r.profiles as
      | { full_name?: string | null; email?: string }
      | { full_name?: string | null; email?: string }[]
      | null
    const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
    return {
      id: r.id as string,
      number: r.number as string,
      kind: r.kind as string,
      amountCents: r.amount_cents as number,
      periodLabel: (r.period_label as string | null) ?? null,
      createdAt: r.created_at as string,
      paid: payment?.status === 'succeeded',
      memberName: profile?.full_name?.trim() || profile?.email || 'Member',
      userId: r.user_id as string,
    }
  })
}

function fmtTtd(cents: number): string {
  return `TTD $${(cents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

export default async function AdminInvoicesPage() {
  const invoices = await loadInvoices()
  const unpaid = invoices.filter((i) => !i.paid)
  const unpaidCents = unpaid.reduce((s, i) => s + i.amountCents, 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Invoices</h1>
        <p className="text-neutral-600 max-w-2xl">
          Official Pinnacle invoices — numbered, emailed with a Wam pay link, and
          marked paid automatically the moment the money confirms. Monthly
          members are invoiced automatically on the
          1st of each month.
        </p>
      </div>

      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-neutral-600">
          <span className="font-heading text-xl text-neutral-900">
            {fmtTtd(unpaidCents)}
          </span>{' '}
          outstanding across {unpaid.length} unpaid invoice
          {unpaid.length === 1 ? '' : 's'}
        </p>
        <RunMonthlyInvoicingButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="font-heading text-lg mb-4">New invoice</h2>
          <AdminInvoiceForm />
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="font-heading text-lg">Recent</h2>
          </div>
          {invoices.length === 0 ? (
            <p className="p-6 text-sm text-neutral-500">
              No invoices yet. Send one, or run the monthly invoicing.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100 max-h-[40rem] overflow-y-auto">
              {invoices.map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={`/dashboard/invoices/${inv.id}`}
                    className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-neutral-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">
                        {inv.number} · {inv.memberName}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {KIND_LABEL[inv.kind] ?? inv.kind}
                        {inv.periodLabel && ` · ${inv.periodLabel}`}
                        {` · ${fmtAstDate(inv.createdAt)}`}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-medium">
                        {fmtTtd(inv.amountCents)}
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
          )}
        </section>
      </div>
    </div>
  )
}
