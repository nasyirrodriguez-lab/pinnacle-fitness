import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const { name, email, phone, classDay, classTime, className } = await req.json()

  if (!name || !email || !phone || !classDay || !classTime) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error: dbError } = await admin.from('free_trial_bookings').insert({
    name,
    email,
    phone,
    class_name: className ?? 'Free Trial',
    class_day: classDay,
    class_time: classTime,
  })

  if (dbError) {
    console.error('[Free Trial] DB error:', dbError)
    return NextResponse.json({ error: 'Failed to save booking.' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  const confirmationHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1C1A17;">
      <h2 style="margin: 0 0 8px; font-size: 24px;">You're booked, ${name}!</h2>
      <p style="color: #6B6560; margin: 0 0 24px;">Here are your free class details.</p>
      <div style="background: #D6D3CC; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px;"><strong>Day:</strong> ${classDay}</p>
        <p style="margin: 0;"><strong>Time:</strong> ${classTime}</p>
      </div>
      <p style="color: #6B6560;">Come along, bring water, and we'll handle the rest.</p>
      <p style="color: #6B6560; margin-top: 16px;">— Pinnacle Fitness<br>227 Western Main Road, Cocorite, Trinidad</p>
    </div>
  `

  const adminHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1C1A17;">
      <h2 style="margin: 0 0 24px; font-size: 20px;">New Free Trial Booking</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #C4C1BA; color: #6B6560; width: 100px;">Name</td><td style="padding: 8px 0; border-bottom: 1px solid #C4C1BA;">${name}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #C4C1BA; color: #6B6560;">Email</td><td style="padding: 8px 0; border-bottom: 1px solid #C4C1BA;"><a href="mailto:${email}">${email}</a></td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #C4C1BA; color: #6B6560;">Phone</td><td style="padding: 8px 0; border-bottom: 1px solid #C4C1BA;">${phone}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #C4C1BA; color: #6B6560;">Day</td><td style="padding: 8px 0; border-bottom: 1px solid #C4C1BA;">${classDay}</td></tr>
        <tr><td style="padding: 8px 0; color: #6B6560;">Time</td><td style="padding: 8px 0;">${classTime}</td></tr>
      </table>
    </div>
  `

  await Promise.all([
    resend.emails.send({
      from: 'Pinnacle Fitness <onboarding@resend.dev>',
      to: email,
      subject: `You're booked at Pinnacle Fitness!`,
      html: confirmationHtml,
    }),
    resend.emails.send({
      from: 'Pinnacle Fitness <onboarding@resend.dev>',
      to: 'nasyirrodriguez@gmail.com',
      subject: `New Free Trial Booking: ${name} → ${classDay} at ${classTime}`,
      html: adminHtml,
    }),
  ])

  return NextResponse.json({ success: true })
}
