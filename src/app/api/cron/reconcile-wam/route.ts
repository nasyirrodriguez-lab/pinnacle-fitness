import { NextRequest, NextResponse } from 'next/server'
import { reconcilePendingWamBatch } from '@/lib/payments/reconcile'

// =====================================================================
// Cron: check pending Wam payments every 10 minutes. This never marks a
// payment paid — only the payment_intent.succeeded webhook (or explicit
// admin verification) confirms. It marks failed/abandoned attempts and
// stamps payments Wam reports as paid so admins can confirm them.
//
// Vercel sends `Authorization: Bearer ${CRON_SECRET}` on cron
// invocations when the CRON_SECRET env var is set on the project —
// which it must be, otherwise this endpoint rejects everything.
// =====================================================================

export const maxDuration = 120

// Up to 5 batches of 10 per run keeps a single invocation well inside
// the function timeout even if every Wam call is slow.
const MAX_BATCHES = 5

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/reconcile-wam] CRON_SECRET is not set')
    return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let scanned = 0
  let wamVerified = 0
  let failed = 0
  let batches = 0

  for (let i = 0; i < MAX_BATCHES; i++) {
    const result = await reconcilePendingWamBatch(10)
    batches++
    if (!result.ok) {
      console.error('[cron/reconcile-wam] batch failed:', result.error)
      break
    }
    scanned += result.scanned
    wamVerified += result.wamVerified
    failed += result.failed
    if (result.remainingAfter === 0 || result.scanned === 0) break
  }

  if (scanned > 0) {
    console.log(
      `[cron/reconcile-wam] batches=${batches} scanned=${scanned} wamVerified=${wamVerified} failed=${failed}`
    )
  }

  return NextResponse.json({ ok: true, batches, scanned, wamVerified, failed })
}
