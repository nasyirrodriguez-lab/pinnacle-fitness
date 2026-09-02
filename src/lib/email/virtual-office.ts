import { Resend } from 'resend'
import { getEmailFrom } from './sender'
import {
  BRAND,
  ctaButton,
  display,
  emailLayout,
  escapeHtml,
  eyebrow,
  paragraph,
} from './layout'

interface NotifyArgs {
  to: string
  recipientName: string | null
  businessName: string
  sender: string | null
  label: string | null
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://theworx.io'

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-family:'Unbounded',Arial,sans-serif;font-weight:500;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${BRAND.navy};width:90px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-family:'Sen',Helvetica,Arial,sans-serif;font-size:15px;color:${BRAND.ink};font-weight:500;">${escapeHtml(value)}</td>
  </tr>`
}

export async function sendVirtualOfficeMailNotification(args: NotifyArgs) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.log('[vo/email] (no RESEND_API_KEY) would notify', args.to)
    return
  }

  const greetingName = args.recipientName
    ? escapeHtml(args.recipientName.split(' ')[0])
    : 'there'

  const rows = [
    detailRow('For', args.businessName),
    args.sender ? detailRow('From', args.sender) : '',
    args.label ? detailRow('Item', args.label) : '',
  ]
    .filter(Boolean)
    .join('')

  const body = `
    ${eyebrow('Virtual office · mail received')}
    ${display(`Mail for you,<br>${greetingName}.`)}
    ${paragraph(
      `A new piece of mail just arrived for you at our Port of Spain address. We&rsquo;ve logged it and stored it safely.`
    )}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;background:${BRAND.cornbird};">
      <tbody><tr><td style="padding:24px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tbody>${rows}</tbody>
        </table>
      </td></tr></tbody>
    </table>
    ${ctaButton(`${SITE_URL}/dashboard/mail`, 'View in your inbox')}
    ${paragraph(
      `<span style="color:${BRAND.muted};font-size:14px;">Mail stays with us for 30 days. Reply to this email if you&rsquo;d like us to forward it on, or come by to collect.</span>`
    )}
  `

  const html = emailLayout({
    preheader: `New mail for ${args.businessName}`,
    body,
  })

  const resend = new Resend(resendKey)
  await resend.emails.send({
    from: getEmailFrom(),
    to: args.to,
    subject: `New mail for ${args.businessName}`,
    html,
  })
}
