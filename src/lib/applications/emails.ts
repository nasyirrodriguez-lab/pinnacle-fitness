import { Resend } from 'resend'
import { getEmailFrom } from '@/lib/email/sender'
import {
  emailLayout,
  eyebrow,
  display,
  paragraph,
  ctaButton,
  escapeHtml,
} from '@/lib/email/layout'
import { CONTACT } from '@/config/location'

// The three emails an applicant can get after the coaches look at them.
// All warm, all specific about what happens next, none of them a reason.

async function send(args: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: getEmailFrom(),
      to: args.to,
      subject: args.subject,
      html: args.html,
    })
    return true
  } catch (err) {
    console.warn('[applications] email failed:', err)
    return false
  }
}

function first(name: string): string {
  return escapeHtml(name.trim().split(/\s+/)[0] || 'there')
}

export function sendWaitlistedEmail(args: { to: string; fullName: string }) {
  return send({
    to: args.to,
    subject: "You're on the Pinnacle waitlist",
    html: emailLayout({
      preheader: 'We keep membership small — spots open as they come up.',
      body: [
        eyebrow('Application'),
        display(`You're on the list, ${first(args.fullName)}`),
        paragraph(
          'We keep membership small so the coaches know every member by name, which means we open spots as they come up rather than all at once. You’re on the waitlist — when a spot opens you’ll get an email with a link to pick your plan.'
        ),
        paragraph(
          'Nothing to do for now. If your details change, just reply to this email.'
        ),
      ].join(''),
    }),
  })
}

export function sendDeclinedEmail(args: { to: string; fullName: string }) {
  return send({
    to: args.to,
    subject: 'About your Pinnacle application',
    html: emailLayout({
      preheader: "We're at capacity right now.",
      body: [
        eyebrow('Application'),
        display(`Thanks for applying, ${first(args.fullName)}`),
        paragraph(
          'We’re not able to offer a spot right now — we’re at capacity for the kind of coaching we do, and we’d rather say so than keep you waiting.'
        ),
        paragraph(
          `If you’d like to be considered again down the line, reply to this email and we’ll keep you in mind. Either way, thanks for wanting to train with us. — Nasyir & Matthew`
        ),
      ].join(''),
    }),
  })
}

export function sendInviteEmail(args: {
  to: string
  fullName: string
  planName: string | null
  amountCents: number | null
  payUrl: string | null
  expiresAt: string
  signInUrl: string
}) {
  const expires = new Date(args.expiresAt).toLocaleDateString('en-US', {
    timeZone: 'America/Port_of_Spain',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const planLine =
    args.planName && args.amountCents
      ? paragraph(
          `Your plan: <strong>${escapeHtml(args.planName)}</strong> · TT$${(args.amountCents / 100).toFixed(0)}. Pay below and your membership is live the moment it confirms. This link is good until <strong>${expires}</strong>; after that the spot goes back to the list.`
        )
      : paragraph(
          `Sign in below to pick your plan. Your spot is held until <strong>${expires}</strong>.`
        )
  return send({
    to: args.to,
    subject: "You're in — welcome to Pinnacle",
    html: emailLayout({
      preheader:
        'A spot opened up. Pay to activate and book your first session.',
      body: [
        eyebrow('You’re in'),
        display(`Welcome to Pinnacle, ${first(args.fullName)}`),
        paragraph(
          'The coaches have approved your application. Three things to do:'
        ),
        planLine,
        args.payUrl
          ? ctaButton(args.payUrl, 'Pay & activate')
          : ctaButton(args.signInUrl, 'Sign in & choose a plan'),
        paragraph(
          `Then sign in at <a href="${args.signInUrl}">${escapeHtml(CONTACT.domain)}</a> on your phone, add it to your home screen, set your 4-digit PIN, and book your first session. Questions — reply here or catch us at the desk.`
        ),
      ].join(''),
    }),
  })
}
