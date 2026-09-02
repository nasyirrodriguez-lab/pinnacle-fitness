import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { invoiceMonthlyRenters } from '@/lib/invoices/monthly'

// Cron: on the 1st of each month, invoice every office renter and
// virtual-office holder for the month. Idempotent — safe to re-run.

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/monthly-invoices] CRON_SECRET is not set')
    return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await invoiceMonthlyRenters(createAdminClient())
  if (result.errors.length > 0) {
    console.error('[cron/monthly-invoices] errors:', result.errors)
  }
  return NextResponse.json(result)
}
