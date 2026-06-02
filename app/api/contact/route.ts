import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, subject, message } = body

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 })
  }

  // In production: send via Resend, SendGrid, etc.
  // For now we log and return success so the form works end-to-end.
  console.log('[Contact Form]', { name, email, subject, message })

  return NextResponse.json({ success: true })
}
