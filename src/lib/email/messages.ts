import { Resend } from 'resend'
import { getEmailFrom } from '@/lib/email/sender'
import {
  emailLayout,
  eyebrow,
  display,
  paragraph,
  ctaButton,
  escapeHtml,
  SUPPORT_EMAIL,
} from '@/lib/email/layout'
import type { SupabaseClient } from '@supabase/supabase-js'

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://theworx.io'
  )
}

// A member wrote to the team from their dashboard — land it in the
// team inbox too so replies don't depend on someone watching the admin.
export async function sendMemberMessageToTeam(args: {
  admin: SupabaseClient
  memberName: string
  memberEmail: string
  body: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: getEmailFrom(),
      to: SUPPORT_EMAIL,
      replyTo: args.memberEmail,
      subject: `Member message — ${args.memberName}`,
      html: emailLayout({
        preheader: args.body.slice(0, 120),
        body: [
          eyebrow('Member message'),
          display(args.memberName),
          paragraph(escapeHtml(args.body).replace(/\n/g, '<br/>')),
          ctaButton(`${getSiteUrl()}/admin/notifications`, 'Reply in admin'),
          paragraph(
            `Or just hit reply — this email answers straight to ${escapeHtml(args.memberEmail)}.`
          ),
        ].join(''),
      }),
    })
    await args.admin.from('email_log').insert({
      to_email: SUPPORT_EMAIL,
      template: 'member-message',
      subject: `Member message — ${args.memberName}`,
      resend_message_id: data?.id ?? null,
      status: error ? 'failed' : 'sent',
      error: error?.message ?? null,
    })
  } catch (err) {
    console.warn('[messages] team email failed:', err)
  }
}
