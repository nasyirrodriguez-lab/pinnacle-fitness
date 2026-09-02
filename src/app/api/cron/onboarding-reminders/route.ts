import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendBroadcast } from '@/lib/email/broadcast'
import { sendMemberNotification } from '@/lib/notifications/notify'
import { CURRENT_TERMS_VERSION } from '@/config/terms'

// =====================================================================
// Cron: weekly nudge for accounts that never finished onboarding
// (no name on file, or terms not accepted on the current version).
// The ISO-week template key means each person gets at most one email
// per week, and stops entirely once they complete onboarding.
// =====================================================================

export const maxDuration = 300

function isoWeekKey(): string {
  const d = new Date()
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(
    ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getUTCDay() + 1) / 7
  )
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/onboarding-reminders] CRON_SECRET is not set')
    return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select(
      'id, email, full_name, terms_version, terms_accepted_at, created_at'
    )
    .eq('archived', false)
    .neq('role', 'admin')
    .not('email', 'is', null)
    .gte(
      'created_at',
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    )
  if (error) {
    console.error('[cron/onboarding-reminders] query failed:', error)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }

  type Row = {
    id: string
    email: string
    full_name: string | null
    terms_version: string | null
    terms_accepted_at: string | null
    created_at: string
  }
  const incomplete = ((data as Row[] | null) ?? []).filter((p) => {
    // Same rules as the /welcome gate.
    const missingName = !p.full_name || p.full_name.trim().length === 0
    const missingTerms =
      p.terms_version !== CURRENT_TERMS_VERSION || !p.terms_accepted_at
    // Give brand-new signups a day before nudging.
    const oldEnough =
      Date.now() - new Date(p.created_at).getTime() > 24 * 60 * 60 * 1000
    return (missingName || missingTerms) && oldEnough
  })

  if (incomplete.length === 0) {
    return NextResponse.json({ ok: true, reminded: 0 })
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'https://pinnaclefitness.app'
  const result = await sendBroadcast({
    admin,
    input: {
      subject: 'Finish setting up your Pinnacle account',
      bodyMarkdown: `You're one step away — your Pinnacle account isn't fully set up yet, so some things (bookings, passes, check-in) won't work smoothly until it is.\n\nIt takes under a minute: ${siteUrl}/welcome\n\nNeed a hand? Just reply to this email.`,
      recipients: incomplete.map((p) => ({
        userId: p.id,
        email: p.email,
        fullName: p.full_name,
      })),
      template: `onboarding-reminder:${isoWeekKey()}`,
    },
  })

  for (const p of incomplete.slice(0, 50)) {
    await sendMemberNotification(admin, {
      userId: p.id,
      title: 'Finish setting up your account',
      body: 'Complete your profile at pinnaclefitness.app/welcome so bookings, passes, and check-in all work smoothly.',
      createdBy: null,
    })
  }

  console.log(
    `[cron/onboarding-reminders] candidates=${incomplete.length} sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`
  )
  return NextResponse.json({ ok: true, ...result })
}
