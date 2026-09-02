import { Resend } from 'resend'
import { getEmailFrom } from './sender'
import {
  BRAND,
  ctaButton,
  display,
  emailLayout,
  escapeHtml,
  eyebrow,
  infoBlock,
  paragraph,
} from './layout'

interface SendWelcomeArgs {
  email: string
  firstName: string
  explorePassExpiresAt?: Date
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/Port_of_Spain',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://theworx.io'

function buildHtml({
  firstName,
  explorePassExpiresAt,
}: {
  firstName: string
  explorePassExpiresAt?: Date
}) {
  const greetingName = firstName ? escapeHtml(firstName) : 'there'

  const explorePassBlock = explorePassExpiresAt
    ? infoBlock({
        eyebrow: 'On us · explore pass',
        title: 'A free day to come try us out.',
        body: `We&rsquo;ve put one free day at a hot desk on your account &mdash; redeem any time before <strong>${escapeHtml(formatDate(explorePassExpiresAt))}</strong>. Just walk in and the front desk will sort you out.`,
        background: 'cornbird',
      })
    : ''

  const body = `
    ${eyebrow('A note · for you')}
    ${display(`Welcome,<br>${greetingName}.`)}
    ${paragraph(
      `You&rsquo;re in. The Worx isn&rsquo;t just a coworking space &mdash; it&rsquo;s where the people moving Trinidad &amp; Tobago forward come to build. Glad to have you with us.`
    )}
    ${explorePassBlock}
    ${infoBlock({
      eyebrow: 'Wi-Fi · drop in and connect',
      title: 'Network: The Worx',
      body: `Password: <strong style="font-family:'Sen',monospace,Helvetica,Arial,sans-serif;letter-spacing:0.04em;">dobeTTer</strong>. The same network covers every floor &mdash; if it ever drops, give it a minute and reconnect, or grab someone at the desk.`,
      background: 'navy',
    })}
    ${infoBlock({
      eyebrow: 'House rules · in short',
      title: 'A few things that keep the space great.',
      body: `&bull;&nbsp; Calls and meetings: use the phone booths or book a meeting room &mdash; the floor stays head-down.<br>&bull;&nbsp; Clean as you go &mdash; bring your mug back, leave the desk how you&rsquo;d like to find it.<br>&bull;&nbsp; Be kind to the team and to each other. Guests are welcome with a heads-up.<br>&bull;&nbsp; Member-only spaces (dedicated desks, lockers) belong to whoever&rsquo;s name is on them.`,
      background: 'cornbird',
    })}
    ${paragraph(
      `Your member dashboard is where the practical stuff lives: book a room, manage your plan, see your billing. It takes about thirty seconds to look around.`
    )}
    ${ctaButton(`${SITE_URL}/dashboard`, 'Open my dashboard')}
    ${infoBlock({
      eyebrow: 'A few things worth knowing',
      title: 'Reply to this email any time.',
      body: `It goes straight to the team. We host events, workshops, and casual hangs &mdash; follow on <a href="https://www.instagram.com/wearetheworx" style="color:${BRAND.navy};text-decoration:underline;">Instagram</a> or <a href="https://www.linkedin.com/company/wearetheworx" style="color:${BRAND.navy};text-decoration:underline;">LinkedIn</a> to keep up.`,
      background: 'sulphur',
    })}
    ${paragraph(
      `Wishing you good work, good people, and a few small wins this week. See you in the space.<br><span style="color:${BRAND.navy};font-family:'Unbounded',Arial,sans-serif;font-weight:500;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">&mdash;&nbsp;The&nbsp;Worx&nbsp;team</span>`
    )}
  `
  return emailLayout({
    preheader: explorePassExpiresAt
      ? "You're in. Free day on us — come try The Worx."
      : "You're in. Here's how to get going.",
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
      subject: 'Welcome to The Worx',
      html: buildHtml({
        firstName: args.firstName,
        explorePassExpiresAt: args.explorePassExpiresAt,
      }),
    })
  } catch (err) {
    console.warn('[welcome-email] send failed:', err)
  }
}
