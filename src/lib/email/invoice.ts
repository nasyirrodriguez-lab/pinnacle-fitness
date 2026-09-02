import { Resend } from 'resend'
import {
  emailLayout,
  eyebrow,
  display,
  paragraph,
  ctaButton,
} from '@/lib/email/layout'
import { getEmailFrom } from '@/lib/email/sender'
import { fmtAstDate } from '@/lib/time/ast'
import type { InvoiceLineItem } from '@/lib/invoices/create'

// The official Pinnacle invoice, in email form: numbered, line-itemed, with
// a Pay-now button wired to our payment tracking.

function fmtTtd(cents: number): string {
  return `TTD $${(cents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`
}

function lineItemsTable(items: InvoiceLineItem[], totalCents: number): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:14px;">${item.label}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:14px;text-align:right;white-space:nowrap;">${fmtTtd(item.amountCents)}</td>
        </tr>`
    )
    .join('')
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
      ${rows}
      <tr>
        <td style="padding:12px 0;font-size:15px;font-weight:bold;">Total due</td>
        <td style="padding:12px 0;font-size:15px;font-weight:bold;text-align:right;white-space:nowrap;">${fmtTtd(totalCents)}</td>
      </tr>
    </table>`
}

export async function sendInvoiceEmail(args: {
  to: string
  firstName: string | null
  number: string
  lineItems: InvoiceLineItem[]
  amountCents: number
  periodLabel: string | null
  dueAt: string | null
  payUrl: string
  viewUrl: string
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const name = args.firstName?.trim() || 'there'
  const body = [
    eyebrow(`Invoice ${args.number}`),
    display(`Hi ${name}, your Pinnacle invoice is ready`),
    paragraph(
      [
        args.periodLabel
          ? `Billing period: <strong>${args.periodLabel}</strong>.`
          : '',
        args.dueAt ? `Due by <strong>${fmtAstDate(args.dueAt)}</strong>.` : '',
      ]
        .filter(Boolean)
        .join(' ') || 'Details below.'
    ),
    lineItemsTable(args.lineItems, args.amountCents),
    ctaButton(args.payUrl, `Pay ${fmtTtd(args.amountCents)} now`),
    paragraph(
      `Prefer to settle at the front desk? Cash and card both work — just mention invoice ${args.number}. You can also <a href="${args.viewUrl}">view this invoice in your dashboard</a>.`
    ),
  ].join('')

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: getEmailFrom(),
      to: args.to,
      subject: `Pinnacle Fitness — Invoice ${args.number} (${fmtTtd(args.amountCents)})`,
      html: emailLayout({
        preheader: `Invoice ${args.number}: ${fmtTtd(args.amountCents)}${args.periodLabel ? ` for ${args.periodLabel}` : ''}`,
        body,
      }),
    })
    return true
  } catch (err) {
    console.warn('[invoice-email] send failed:', err)
    return false
  }
}
