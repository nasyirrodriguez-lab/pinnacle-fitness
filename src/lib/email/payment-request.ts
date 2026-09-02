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

// Sent when an admin assigns a plan/pass and asks the member to pay.
// The product activates automatically the moment the payment succeeds.

export async function sendPaymentRequestEmail(args: {
  to: string
  firstName: string | null
  productName: string
  amountCents: number
  payUrl: string
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const name = args.firstName?.trim() || 'there'
  const amount = `TTD $${(args.amountCents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
  const body = [
    eyebrow('Payment request'),
    display(`Hi ${name}, you're all set up`),
    paragraph(
      `The Worx team has set you up with <strong>${args.productName}</strong>. One step left — once you pay, it's active immediately.`
    ),
    infoBlock({
      eyebrow: args.productName,
      title: amount,
      body: 'Pay securely online with the button below, or settle at the front desk.',
      background: 'cornbird',
    }),
    ctaButton(args.payUrl, 'Pay now'),
    paragraph(
      'Questions? Just reply to this email or message us from your dashboard.'
    ),
  ].join('')

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: getEmailFrom(),
      to: args.to,
      subject: `Payment request — ${args.productName}`,
      html: emailLayout({
        preheader: `${args.productName}: ${amount} — pay to activate`,
        body,
      }),
    })
    return true
  } catch (err) {
    console.warn('[payment-request] send failed:', err)
    return false
  }
}
