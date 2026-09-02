import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

// =====================================================================
// Polled by /checkout/complete after the user returns from Wam.
//
// Read-only. Merely returning from Wam's checkout proves nothing — this
// route used to confirm payments from a status poll and that marked
// click-throughs as paid. Confirmation now comes exclusively from the
// payment_intent.succeeded webhook (or an admin explicitly verifying
// the payment against Wam); this endpoint just reports our row so the
// page can flip the moment that happens.
// =====================================================================

const TERMINAL_STATUSES = new Set([
  'succeeded',
  'failed',
  'refunded',
  'cancelled',
])

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const paymentId = request.nextUrl.searchParams.get('paymentId')
  if (!paymentId) {
    return NextResponse.json(
      { error: 'paymentId is required' },
      { status: 400 }
    )
  }

  // Read via the user's session so RLS guarantees they can only see
  // their own payments.
  const { data: payment, error } = await supabase
    .from('payments')
    .select('id, status, kind, amount_cents, currency, paid_at')
    .eq('id', paymentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !payment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const row = payment as {
    status: string
    kind: string
    amount_cents: number
    currency: string
    paid_at: string | null
  }

  return NextResponse.json({
    status: row.status,
    isTerminal: TERMINAL_STATUSES.has(row.status),
    kind: row.kind,
    amountCents: row.amount_cents,
    currency: row.currency,
    paidAt: row.paid_at,
  })
}
