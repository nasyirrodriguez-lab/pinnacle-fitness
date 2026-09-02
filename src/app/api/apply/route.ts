import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/utils/supabase/admin'
import { getEmailFrom } from '@/lib/email/sender'
import {
  emailLayout,
  eyebrow,
  display,
  paragraph,
  escapeHtml,
} from '@/lib/email/layout'
import { applySchema } from '@/lib/schemas/apply'

// =====================================================================
// The front door. Applicants who haven't trained six months yet are
// screened out on the spot with a warm answer (never ghosted); everyone
// else lands in the applications queue with a confirmation email and a
// heads-up to the coaches.
// =====================================================================

const GYM_EMAIL = 'hello@pinnaclefitness.app'

export type ApplyResponse =
  | { ok: true; screenedOut: false }
  | { ok: true; screenedOut: true }
  | { ok: false; error: string }

const BRACKET_LABEL: Record<string, string> = {
  under_6m: 'Under 6 months',
  '6_24m': '6–24 months',
  '2y_plus': '2+ years',
}

export async function POST(request: NextRequest) {
  let data
  try {
    data = applySchema.parse(await request.json())
  } catch {
    return NextResponse.json<ApplyResponse>(
      { ok: false, error: 'Check the form — something is missing.' },
      { status: 400 }
    )
  }
  // Honeypot filled → pretend success, save nothing.
  if (data.company && data.company.length > 0) {
    return NextResponse.json<ApplyResponse>({ ok: true, screenedOut: false })
  }

  const admin = createAdminClient()
  const email = data.email.toLowerCase()

  // One live application per person at a time.
  const { data: existing } = await admin
    .from('applications')
    .select('id, status')
    .eq('email', email)
    .in('status', ['new', 'intro_booked', 'waitlisted', 'invited'])
    .gte(
      'created_at',
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    )
    .limit(1)
  if (existing && existing.length > 0) {
    return NextResponse.json<ApplyResponse>(
      {
        ok: false,
        error:
          "You've already applied — a coach has it. If you haven't heard back in a week, message us on WhatsApp.",
      },
      { status: 409 }
    )
  }

  const screenedOut = data.experienceBracket === 'under_6m'
  const { error } = await admin.from('applications').insert({
    full_name: data.fullName,
    email,
    phone: data.phone,
    experience_bracket: data.experienceBracket,
    training_now: data.trainingNow,
    goal: data.goal,
    heard_from: data.heardFrom?.trim() || null,
    referred_by: data.referredBy?.trim() || null,
    plan_interest: data.planInterest?.trim() || null,
    code_accepted_at: new Date().toISOString(),
    status: screenedOut ? 'screened_out' : 'new',
  })
  if (error) {
    console.error('[apply] insert failed:', error)
    return NextResponse.json<ApplyResponse>(
      { ok: false, error: 'Could not send your application — try again.' },
      { status: 500 }
    )
  }

  if (!screenedOut) {
    await sendEmails({
      name: data.fullName,
      email,
      phone: data.phone,
      bracket: BRACKET_LABEL[data.experienceBracket] ?? data.experienceBracket,
      trainingNow: data.trainingNow,
      goal: data.goal,
      referredBy: data.referredBy?.trim() || null,
      planInterest: data.planInterest?.trim() || null,
    })
  }

  return NextResponse.json<ApplyResponse>({ ok: true, screenedOut })
}

async function sendEmails(a: {
  name: string
  email: string
  phone: string
  bracket: string
  trainingNow: string
  goal: string
  referredBy: string | null
  planInterest: string | null
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  const resend = new Resend(apiKey)
  const first = a.name.split(/\s+/)[0]

  const applicantHtml = emailLayout({
    preheader: 'We have your application — here is what happens next.',
    body: [
      eyebrow('Application received'),
      display(`Got it, ${escapeHtml(first)}.`),
      paragraph(
        "A coach reads every application personally. Here's what happens next:"
      ),
      paragraph(
        '<strong>1.</strong> Nasyir or Matthew reads yours.<br/><strong>2.</strong> You get invited to an intro session — come train, meet the coaches, see the floor.<br/><strong>3.</strong> If it fits both ways, you pick a plan and you are in.'
      ),
      paragraph(
        'We keep membership small on purpose, so it can take a little time. If a week goes by with nothing, message us on WhatsApp: Nasyir 688-6887 · Matthew 724-5734.'
      ),
    ].join(''),
  })

  const coachHtml = emailLayout({
    preheader: `${a.name} applied — ${a.bracket}`,
    body: [
      eyebrow('New application'),
      display(escapeHtml(a.name)),
      paragraph(
        `<strong>Training for:</strong> ${escapeHtml(a.bracket)}<br/>` +
          `<strong>Email:</strong> ${escapeHtml(a.email)}<br/>` +
          `<strong>Phone:</strong> ${escapeHtml(a.phone)}` +
          (a.planInterest
            ? `<br/><strong>Plan interest:</strong> ${escapeHtml(a.planInterest)}`
            : '') +
          (a.referredBy
            ? `<br/><strong>Referred by:</strong> ${escapeHtml(a.referredBy)}`
            : '')
      ),
      paragraph(
        `<strong>Training now:</strong><br/>${escapeHtml(a.trainingNow).replace(/\n/g, '<br/>')}`
      ),
      paragraph(
        `<strong>Goal:</strong><br/>${escapeHtml(a.goal).replace(/\n/g, '<br/>')}`
      ),
      paragraph('Review it in the admin under Applications.'),
    ].join(''),
  })

  try {
    await Promise.all([
      resend.emails.send({
        from: getEmailFrom(),
        to: a.email,
        subject: 'Your Pinnacle application — what happens next',
        html: applicantHtml,
      }),
      resend.emails.send({
        from: getEmailFrom(),
        to: GYM_EMAIL,
        replyTo: a.email,
        subject: `New application — ${a.name} (${a.bracket})`,
        html: coachHtml,
      }),
    ])
  } catch (err) {
    console.warn('[apply] email failed:', err)
  }
}
