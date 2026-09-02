import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getCurrentUser } from '@/lib/auth/current-user'
import { referralSchema } from '@/lib/schemas/referral'
import { getEmailFrom } from '@/lib/email/sender'

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHtml(args: {
  referrerName: string
  referrerEmail: string
  friendName: string
  friendEmail: string
  note?: string
}) {
  const noteBlock = args.note
    ? `<h3 style="color:#333;">Note from ${escapeHtml(args.referrerName)}</h3>
       <p style="white-space: pre-wrap;">${escapeHtml(args.note)}</p>`
    : ''
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New member referral</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 140px;">Referred by</td>
          <td style="padding: 8px 0;">${escapeHtml(args.referrerName)} (${escapeHtml(args.referrerEmail)})</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Friend's name</td>
          <td style="padding: 8px 0;">${escapeHtml(args.friendName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Friend's email</td>
          <td style="padding: 8px 0;">${escapeHtml(args.friendEmail)}</td>
        </tr>
      </table>
      ${noteBlock}
    </div>
  `
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let data
  try {
    data = referralSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const referrerName = user.fullName ?? 'A member'
  const referrerEmail = user.email

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: getEmailFrom(),
    to: 'hello@pinnaclefitness.app',
    replyTo: referrerEmail || undefined,
    subject: `Referral: ${data.friendName} (via ${referrerName})`,
    html: buildHtml({
      referrerName,
      referrerEmail,
      friendName: data.friendName,
      friendEmail: data.friendEmail,
      note: data.note,
    }),
  })

  if (error) {
    console.error('[refer] resend error:', error)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
