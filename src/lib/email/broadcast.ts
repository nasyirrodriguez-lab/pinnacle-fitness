import { Resend } from 'resend'
import { getEmailFrom } from './sender'
import { signToken } from '@/lib/jwt'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BRAND, emailLayout, paragraph } from './layout'

interface Recipient {
  userId: string
  email: string
  fullName: string | null
}

interface BroadcastInput {
  subject: string
  bodyMarkdown: string
  // Pre-rendered HTML wins over bodyMarkdown when provided (for emails
  // with links/buttons the plain-text pipeline can't express).
  bodyHtml?: string
  recipients: Recipient[]
  template: string
}

interface BroadcastResult {
  sent: number
  failed: number
  skipped: number
  errors: { email: string; error: string }[]
}

// Resend allows 5 requests/second — 4 concurrent sends with a 1s gap
// stays safely under it. (25 at a time is what killed the May broadcast.)
const BATCH_SIZE = 4
const BETWEEN_BATCHES_MS = 1000

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'http://localhost:3000'
  )
}

function buildUnsubscribeUrl(email: string): string {
  const token = signToken({
    email: email.toLowerCase(),
    iat: Date.now(),
  })
  return `${getSiteUrl()}/unsubscribe?t=${encodeURIComponent(token)}`
}

// Minimal markdown → HTML for body. We do paragraph + line break conversion
// only; admins can paste plain text and get a sensible email rendered with
// the shared brand styles.
function markdownToHtml(md: string): string {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const paragraphs = escaped.split(/\n{2,}/).filter((p) => p.trim().length > 0)
  return paragraphs.map((p) => paragraph(p.replace(/\n/g, '<br/>'))).join('')
}

function buildHtml(args: {
  fullName: string | null
  bodyHtml: string
  unsubscribeUrl: string
}): string {
  const greeting = args.fullName
    ? paragraph(`Hi ${args.fullName.split(' ')[0].replace(/[<&>]/g, '')},`)
    : ''

  const unsubscribeFooter = `<p style="margin:0;font-family:'Sen',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${BRAND.muted};">
    You&rsquo;re receiving this because you&rsquo;re part of The Worx community.<br>
    <a href="${args.unsubscribeUrl}" style="color:${BRAND.muted};text-decoration:underline;text-underline-offset:2px;">Unsubscribe</a>
  </p>`

  return emailLayout({
    body: `${greeting}${args.bodyHtml}`,
    unsubscribeFooter,
  })
}

// Skip any email that's in the unsubscribes table for `scope IN ('broadcast', 'all')`.
async function filterOptedOut(
  admin: SupabaseClient,
  recipients: Recipient[]
): Promise<Recipient[]> {
  if (recipients.length === 0) return []
  const emails = recipients.map((r) => r.email.toLowerCase())
  const { data } = await admin
    .from('unsubscribes')
    .select('email')
    .in('email', emails)
  const optedOut = new Set(
    ((data as Array<{ email: string }> | null) ?? []).map((r) =>
      r.email.toLowerCase()
    )
  )
  return recipients.filter((r) => !optedOut.has(r.email.toLowerCase()))
}

// Skip any email that already has a successful send for this exact template +
// subject combo. Treats template+subject as the dedup key.
async function filterAlreadySent(
  admin: SupabaseClient,
  recipients: Recipient[],
  template: string,
  subject: string
): Promise<Recipient[]> {
  if (recipients.length === 0) return []
  const emails = recipients.map((r) => r.email.toLowerCase())
  const { data } = await admin
    .from('email_log')
    .select('to_email')
    .eq('template', template)
    .eq('subject', subject)
    .eq('status', 'sent')
    .in('to_email', emails)
  const sent = new Set(
    ((data as Array<{ to_email: string }> | null) ?? []).map((r) =>
      r.to_email.toLowerCase()
    )
  )
  return recipients.filter((r) => !sent.has(r.email.toLowerCase()))
}

export async function sendBroadcast(args: {
  admin: SupabaseClient
  input: BroadcastInput
}): Promise<BroadcastResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return {
      sent: 0,
      failed: 0,
      skipped: args.input.recipients.length,
      errors: [{ email: '*', error: 'RESEND_API_KEY not set' }],
    }
  }

  const bodyHtml =
    args.input.bodyHtml ?? markdownToHtml(args.input.bodyMarkdown)
  const from = getEmailFrom()
  const resend = new Resend(apiKey)

  const afterOptOut = await filterOptedOut(args.admin, args.input.recipients)
  const toSend = await filterAlreadySent(
    args.admin,
    afterOptOut,
    args.input.template,
    args.input.subject
  )
  const skipped = args.input.recipients.length - toSend.length

  let sent = 0
  let failed = 0
  const errors: { email: string; error: string }[] = []

  for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
    const batch = toSend.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (r) => {
        const unsubscribeUrl = buildUnsubscribeUrl(r.email)
        try {
          const { data, error } = await resend.emails.send({
            from,
            to: r.email,
            subject: args.input.subject,
            html: buildHtml({
              fullName: r.fullName,
              bodyHtml,
              unsubscribeUrl,
            }),
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          })

          if (error) {
            failed++
            errors.push({ email: r.email, error: error.message })
            await args.admin.from('email_log').insert({
              user_id: r.userId,
              to_email: r.email,
              template: args.input.template,
              subject: args.input.subject,
              status: 'failed',
              error: error.message,
            })
            return
          }

          sent++
          await args.admin.from('email_log').insert({
            user_id: r.userId,
            to_email: r.email,
            template: args.input.template,
            subject: args.input.subject,
            resend_message_id: data?.id ?? null,
            status: 'sent',
          })
        } catch (err) {
          failed++
          const msg = err instanceof Error ? err.message : 'send failed'
          errors.push({ email: r.email, error: msg })
          await args.admin.from('email_log').insert({
            user_id: r.userId,
            to_email: r.email,
            template: args.input.template,
            subject: args.input.subject,
            status: 'failed',
            error: msg,
          })
        }
      })
    )

    // Throttle between batches to avoid Resend rate limits.
    if (i + BATCH_SIZE < toSend.length) {
      await new Promise((resolve) => setTimeout(resolve, BETWEEN_BATCHES_MS))
    }
  }

  return { sent, failed, skipped, errors: errors.slice(0, 20) }
}
