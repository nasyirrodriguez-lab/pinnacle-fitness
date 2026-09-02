import { Resend } from 'resend'
import { getEmailFrom } from './sender'
import {
  ctaButton,
  display,
  emailLayout,
  escapeHtml,
  eyebrow,
  infoBlock,
  paragraph,
} from './layout'

// The approval email: sent by the applications flow the moment a coach
// approves someone. "You're in" + the three things to do first.

interface SendWelcomeArgs {
  email: string
  firstName: string
  planName?: string | null
  payUrl?: string | null
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
  'https://pinnaclefitness.app'

function buildHtml(args: SendWelcomeArgs) {
  const name = args.firstName ? escapeHtml(args.firstName) : 'there'
  const payBlock =
    args.payUrl && args.planName
      ? infoBlock({
          eyebrow: 'Step 0 · activate',
          title: `Pay for ${escapeHtml(args.planName)} to switch everything on.`,
          body: `Your membership goes live the moment the payment confirms. Cash at the desk works too &mdash; just tell a coach.`,
          background: 'cornbird',
        }) + ctaButton(args.payUrl, 'Pay and activate')
      : ''
  const body = `
    ${eyebrow('Welcome to Pinnacle')}
    ${display(`You&rsquo;re in,<br>${name}.`)}
    ${paragraph(
      `Nasyir and Matthew have approved your application. Pinnacle runs on showing up &mdash; here&rsquo;s how to make your first week count.`
    )}
    ${payBlock}
    ${infoBlock({
      eyebrow: 'Step 1 · install',
      title: 'Put the app on your home screen.',
      body: `Open <a href="${SITE_URL}/sign-in" style="color:inherit;text-decoration:underline;">pinnaclefitness.app</a> on your phone, sign in with this email, then <strong>Share &rarr; Add to Home Screen</strong>. Your check-in QR is then one tap away at the door.`,
      background: 'navy',
    })}
    ${infoBlock({
      eyebrow: 'Step 2 · set up',
      title: 'Thirty seconds of setup.',
      body: `Your goal, anything your coach should know, which coach you want first, and a 4-digit PIN (your back-up if your phone dies at the door).`,
      background: 'sulphur',
    })}
    ${infoBlock({
      eyebrow: 'Step 3 · book',
      title: 'Book your first session.',
      body: `Pick Nasyir or Matthew, pick an hour. Sessions are small groups; open gym is scan-in whenever the floor has room. Cancel free up to 4 hours before.`,
      background: 'cornbird',
    })}
    ${ctaButton(`${SITE_URL}/sign-in`, 'Sign in and get started')}
    ${paragraph(
      `Reply to this email any time &mdash; it goes straight to the coaches. See you on the turf.`
    )}
  `
  return emailLayout({
    preheader: "You're in. Install the app, set your PIN, book your first session.",
    body,
  })
}

export async function sendWelcomeEmail(args: SendWelcomeArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: getEmailFrom(),
      to: args.email,
      subject: "You're in — welcome to Pinnacle",
      html: buildHtml(args),
    })
  } catch (err) {
    console.warn('[welcome-email] send failed:', err)
  }
}
