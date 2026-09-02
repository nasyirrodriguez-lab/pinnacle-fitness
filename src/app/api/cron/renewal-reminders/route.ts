import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendRenewalReminder } from '@/lib/email/payment-reminder'
import { sendMemberNotification } from '@/lib/notifications/notify'

// =====================================================================
// Cron: renewal reminders. Runs daily; catches every membership whose
// period ends 3–4 days from now, so each one gets exactly one nudge
// (email + in-app message) three days out. Registered in vercel.json.
// =====================================================================

export const maxDuration = 120

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/renewal-reminders] CRON_SECRET is not set')
    return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const windowStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  const windowEnd = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)

  const { data, error } = await admin
    .from('subscriptions')
    .select(
      'id, user_id, plan_id, current_period_end, plans(name, price_cents), profiles(email, full_name)'
    )
    .in('status', ['active', 'past_due'])
    .gte('current_period_end', windowStart.toISOString())
    .lt('current_period_end', windowEnd.toISOString())
    .limit(200)
  if (error) {
    console.error('[cron/renewal-reminders] query failed:', error)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }

  type Row = {
    id: string
    user_id: string
    plan_id: string
    current_period_end: string
    plans:
      | { name?: string; price_cents?: number }
      | { name?: string; price_cents?: number }[]
      | null
    profiles:
      | { email: string; full_name: string | null }
      | { email: string; full_name: string | null }[]
      | null
  }

  let sent = 0
  for (const raw of (data as Row[] | null) ?? []) {
    const planRaw = raw.plans
    const plan = Array.isArray(planRaw) ? (planRaw[0] ?? null) : planRaw
    const profRaw = raw.profiles
    const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
    if (!profile?.email) continue

    const planName = plan?.name ?? raw.plan_id
    const firstName = (profile.full_name ?? '').trim().split(/\s+/)[0] || null

    const emailed = await sendRenewalReminder({
      to: profile.email,
      firstName,
      planName,
      periodEndIso: raw.current_period_end,
      priceCents: plan?.price_cents ?? null,
    })
    await sendMemberNotification(admin, {
      userId: raw.user_id,
      title: `Your ${planName} plan renews in 3 days`,
      body: 'Renew from your Plan page or pay cash at the desk. Sessions reset the day it renews — no rollover, so use what you have.',
      createdBy: null,
    })
    if (emailed) sent++
  }

  return NextResponse.json({ scanned: (data ?? []).length, emailed: sent })
}
