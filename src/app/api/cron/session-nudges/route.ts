import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendMemberNotification } from '@/lib/notifications/notify'
import { sendBroadcast } from '@/lib/email/broadcast'
import { sessionBalance } from '@/lib/sessions/ledger'

// =====================================================================
// Cron, daily: two nudges that keep members from running dry.
//   - a pack that expires within 7 days and still has sessions on it
//   - a member down to their last 3 PT sessions (plan or pack)
// Each fires once per pack / once per plan month, deduped through the
// email_log template key (sendBroadcast skips anything already sent).
// =====================================================================

export const maxDuration = 120

function monthKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Port_of_Spain',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7)
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'https://pinnaclefitness.app'

  // ---- packs expiring within 7 days ----
  const now = Date.now()
  const { data: packs } = await admin
    .from('pass_purchases')
    .select(
      'id, user_id, uses_remaining, expires_at, passes(name), profiles!pass_purchases_user_id_fkey(email, full_name)'
    )
    .gt('uses_remaining', 0)
    .gt('expires_at', new Date(now).toISOString())
    .lt('expires_at', new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(200)

  let packNudges = 0
  for (const raw of (packs as Record<string, unknown>[] | null) ?? []) {
    const passRaw = raw.passes as { name?: string } | { name?: string }[] | null
    const pass = Array.isArray(passRaw) ? (passRaw[0] ?? null) : passRaw
    const profRaw = raw.profiles as
      | { email?: string; full_name?: string | null }
      | { email?: string; full_name?: string | null }[]
      | null
    const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
    if (!profile?.email) continue
    const left = raw.uses_remaining as number
    const name = pass?.name ?? 'Your pack'
    const result = await sendBroadcast({
      admin,
      input: {
        subject: `${name}: ${left} session${left === 1 ? '' : 's'} expire this week`,
        bodyMarkdown: `Your ${name} runs out in the next 7 days with ${left} session${left === 1 ? '' : 's'} still on it. Book them in now: ${siteUrl}/book\n\nPacks are valid 30 days — nothing carries over.`,
        recipients: [
          {
            userId: raw.user_id as string,
            email: profile.email,
            fullName: profile.full_name ?? null,
          },
        ],
        template: `pack-expiry:${raw.id as string}`,
      },
    })
    if (result.sent > 0) {
      packNudges++
      await sendMemberNotification(admin, {
        userId: raw.user_id as string,
        title: `${left} session${left === 1 ? '' : 's'} expire this week`,
        body: `Your ${name} runs out in the next 7 days. Book them in before they go.`,
        createdBy: null,
      })
    }
  }

  // ---- down to 3 PT sessions on a counted plan ----
  const { data: subs } = await admin
    .from('subscriptions')
    .select(
      'user_id, plans(pt_sessions_per_month, name), profiles!subscriptions_user_id_fkey(email, full_name)'
    )
    .in('status', ['active', 'past_due'])
    .limit(500)
  let lowNudges = 0
  for (const raw of (subs as Record<string, unknown>[] | null) ?? []) {
    const planRaw = raw.plans as
      | { pt_sessions_per_month?: number | null; name?: string }
      | { pt_sessions_per_month?: number | null; name?: string }[]
      | null
    const plan = Array.isArray(planRaw) ? (planRaw[0] ?? null) : planRaw
    if (!plan || typeof plan.pt_sessions_per_month !== 'number') continue
    if (plan.pt_sessions_per_month <= 0) continue
    const profRaw = raw.profiles as
      | { email?: string; full_name?: string | null }
      | { email?: string; full_name?: string | null }[]
      | null
    const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
    if (!profile?.email) continue
    const userId = raw.user_id as string
    const balance = await sessionBalance(admin, userId, 'pt')
    if (balance > 3 || balance < 0) continue
    const result = await sendBroadcast({
      admin,
      input: {
        subject:
          balance === 0
            ? 'You’re out of PT sessions this month'
            : `${balance} PT session${balance === 1 ? '' : 's'} left this month`,
        bodyMarkdown: `${balance === 0 ? 'Your plan sessions are used up' : `You have ${balance} PT session${balance === 1 ? '' : 's'} left`} until your ${plan.name ?? 'plan'} renews. Want more before then? A 5-pack tops you up in a tap: ${siteUrl}/buy`,
        recipients: [{ userId, email: profile.email, fullName: profile.full_name ?? null }],
        template: `low-sessions:${monthKey()}`,
      },
    })
    if (result.sent > 0) lowNudges++
  }

  return NextResponse.json({ ok: true, packNudges, lowNudges })
}
