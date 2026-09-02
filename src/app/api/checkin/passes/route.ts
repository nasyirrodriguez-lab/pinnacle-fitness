import { NextResponse } from 'next/server'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET() {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('passes')
    .select('id, name, price_cents, currency, uses_total, validity_days')
    .eq('is_active', true)
    .eq('is_private', false)
    .order('price_cents', { ascending: true })
  return NextResponse.json({
    passes: (data ?? []).map((p) => {
      const r = p as {
        id: string
        name: string
        price_cents: number
        currency: string
        uses_total: number
        validity_days: number
      }
      return {
        id: r.id,
        name: r.name,
        priceCents: r.price_cents,
        currency: r.currency,
        usesTotal: r.uses_total,
        validityDays: r.validity_days,
      }
    }),
  })
}
