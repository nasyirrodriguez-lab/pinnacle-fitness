import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, subject, message } = body

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 })
  }

  const { error } = await resend.emails.send({
    from: 'Pinnacle Fitness <onboarding@resend.dev>',
    to: 'pinnaclefitness@gmail.com',
    replyTo: email,
    subject: `New Contact Form Message: ${subject || 'General Inquiry'}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1C1A17;">
        <h2 style="margin: 0 0 24px; font-size: 20px;">New message from ${name}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #E8E3D9; color: #6B6560; width: 100px; vertical-align: top;">Name</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #E8E3D9;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #E8E3D9; color: #6B6560; vertical-align: top;">Email</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #E8E3D9;"><a href="mailto:${email}" style="color: #C85C2D;">${email}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #E8E3D9; color: #6B6560; vertical-align: top;">Subject</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #E8E3D9;">${subject || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 16px 0 0; color: #6B6560; vertical-align: top;">Message</td>
            <td style="padding: 16px 0 0; white-space: pre-wrap;">${message}</td>
          </tr>
        </table>
      </div>
    `,
  })

  if (error) {
    console.error('[Contact Form] Resend error:', error)
    return NextResponse.json({ error: 'Failed to send email.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
