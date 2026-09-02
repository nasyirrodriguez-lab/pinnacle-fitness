import { Resend } from 'resend'
import {
  emailLayout,
  eyebrow,
  display,
  paragraph,
  ctaButton,
  infoBlock,
} from '@/lib/email/layout'
import { getEmailFrom } from '@/lib/email/sender'
import { fmtAstDateTime, fmtAstDate } from '@/lib/time/ast'

// Friendly nudges, not dunning letters. Sent manually by an admin from
// the booking page or a member's page.

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'https://pinnaclefitness.app'
  )
}

function fmtTtd(cents: number): string {
  return `TTD $${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export async function sendBookingPaymentReminder(args: {
  to: string
  firstName: string | null
  resourceName: string
  startIso: string
  amountCents: number
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const name = args.firstName?.trim() || 'there'
  const body = [
    eyebrow('Booking payment'),
    display(`Hi ${name}, a quick one from Pinnacle Fitness`),
    paragraph(
      `Just a friendly reminder that your <strong>${args.resourceName}</strong> booking on <strong>${fmtAstDateTime(args.startIso)}</strong> has a balance of <strong>${fmtTtd(args.amountCents)}</strong>.`
    ),
    paragraph(
      'You can settle it at the front desk — cash or card — or online from your dashboard. If you already sorted this out, ignore us and we’ll see you soon.'
    ),
    ctaButton(`${getSiteUrl()}/dashboard/bookings`, 'View my bookings'),
  ].join('')

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: getEmailFrom(),
      to: args.to,
      subject: `Payment reminder — ${args.resourceName} booking`,
      html: emailLayout({
        preheader: 'A quick booking payment reminder',
        body,
      }),
    })
    return true
  } catch (err) {
    console.warn('[payment-reminder] booking send failed:', err)
    return false
  }
}

export async function sendRenewalReminder(args: {
  to: string
  firstName: string | null
  planName: string
  periodEndIso: string
  priceCents: number | null
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const name = args.firstName?.trim() || 'there'
  const lapsed = new Date(args.periodEndIso).getTime() < Date.now()
  const body = [
    eyebrow('Membership renewal'),
    display(`Hi ${name}, time to renew`),
    paragraph(
      lapsed
        ? `Your <strong>${args.planName}</strong> membership lapsed on <strong>${fmtAstDate(args.periodEndIso)}</strong>. Renew and everything picks up right where it left off.`
        : `Your <strong>${args.planName}</strong> membership is paid through <strong>${fmtAstDate(args.periodEndIso)}</strong> — renewal is coming up.`
    ),
    infoBlock({
      eyebrow: 'Renewal',
      title: args.priceCents != null ? fmtTtd(args.priceCents) : args.planName,
      body: 'Settle at the front desk (cash or card) or reply to this email and we’ll sort you out.',
      background: 'cornbird',
    }),
    paragraph(
      'Thanks for being part of the community — we’d love to keep your seat warm.'
    ),
    ctaButton(`${getSiteUrl()}/dashboard/plan`, 'View my plan'),
  ].join('')

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: getEmailFrom(),
      to: args.to,
      subject: `Your ${args.planName} membership — renewal reminder`,
      html: emailLayout({
        preheader: 'Your Pinnacle membership renewal',
        body,
      }),
    })
    return true
  } catch (err) {
    console.warn('[payment-reminder] renewal send failed:', err)
    return false
  }
}
