import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'
import { inquirySchema } from '@/lib/schemas/inquiry'
import { getEmailFrom } from '@/lib/email/sender'

function buildEmailHtml(data: {
  name: string
  email: string
  interests: string[]
  message?: string
}) {
  const interestsList = data.interests.map((i) => `<li>${i}</li>`).join('')

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Inquiry from ${data.name}</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 100px;">Name</td>
          <td style="padding: 8px 0;">${data.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Email</td>
          <td style="padding: 8px 0;">${data.email}</td>
        </tr>
      </table>
      <h3 style="color: #333;">Interested In</h3>
      <ul style="padding-left: 20px;">${interestsList}</ul>
      ${
        data.message
          ? `<h3 style="color: #333;">Message</h3><p style="white-space: pre-wrap;">${data.message}</p>`
          : ''
      }
    </div>
  `
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = inquirySchema.parse(body)

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('[inquire] RESEND_API_KEY is not set')
      return NextResponse.json(
        { error: 'Email not configured' },
        { status: 500 }
      )
    }
    const resend = new Resend(apiKey)

    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      to: 'hello@pinnaclefitness.app',
      replyTo: data.email,
      subject: `New Inquiry from ${data.name}`,
      html: buildEmailHtml(data),
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json(
        { error: 'Failed to send inquiry' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Inquiry error:', error)
    return NextResponse.json(
      { error: 'Failed to send inquiry' },
      { status: 500 }
    )
  }
}
