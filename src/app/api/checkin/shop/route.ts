import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { createAdminClient } from '@/utils/supabase/admin'
import { getWam } from '@/lib/wam/client'
import { isStaff } from '@/lib/auth/roles'

// =====================================================================
// Front-desk shop on the paired iPad.
//   GET  → products in stock + the team members who can sell (for the PIN gate)
//   POST → a sale: cash (paid now) or Wam QR (pending until the webhook)
//   GET ?paymentId= → poll a Wam sale
// A seller PIN stamps sold_by so cash-ups reconcile per person.
// =====================================================================

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://pinnaclefitness.app'
}

export async function GET(request: NextRequest) {
  const device = await getPairedDevice()
  if (!device) return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  const admin = createAdminClient()

  const paymentId = request.nextUrl.searchParams.get('paymentId')
  if (paymentId) {
    const { data } = await admin.from('payments').select('status, metadata').eq('id', paymentId).maybeSingle()
    const row = data as { status: string; metadata: Record<string, unknown> | null } | null
    if (!row || row.metadata?.shop !== true) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ status: row.status })
  }

  const [{ data: products }, { data: sellers }] = await Promise.all([
    admin.from('products').select('id, name, variant, price_cents, stock').eq('is_active', true).order('display_order').order('name'),
    admin.from('profiles').select('id, full_name, email, role').in('role', ['staff', 'coach', 'owner', 'admin']).eq('archived', false).not('pin_code', 'is', null).order('full_name'),
  ])
  return NextResponse.json({
    products: ((products as { id: string; name: string; variant: string; price_cents: number; stock: number }[] | null) ?? []).map((p) => ({
      id: p.id, name: p.name, variant: p.variant || null, priceCents: p.price_cents, stock: p.stock,
    })),
    sellers: ((sellers as { id: string; full_name: string | null; email: string; role: string }[] | null) ?? []).map((s) => ({
      id: s.id, name: s.full_name?.trim() || s.email,
    })),
  })
}

const saleSchema = z.object({
  sellerId: z.string().uuid(),
  sellerPin: z.string().regex(/^\d{4}$/),
  memberId: z.string().uuid().nullable().optional(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(20) })).min(1).max(20),
  method: z.enum(['cash', 'wam']),
})

export async function POST(request: NextRequest) {
  const device = await getPairedDevice()
  if (!device) return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  let body
  try {
    body = saleSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const admin = createAdminClient()

  const { data: seller } = await admin.from('profiles').select('id, role, pin_code').eq('id', body.sellerId).maybeSingle()
  const s = seller as { id: string; role: string; pin_code: string | null } | null
  if (!s || !isStaff(s.role) || s.pin_code !== body.sellerPin) {
    return NextResponse.json({ error: 'seller_pin' }, { status: 403 })
  }

  const ids = body.items.map((i) => i.productId)
  const { data: productRows } = await admin.from('products').select('id, name, variant, price_cents, stock, is_active').in('id', ids)
  const products = new Map(((productRows as { id: string; name: string; variant: string; price_cents: number; stock: number; is_active: boolean }[] | null) ?? []).map((p) => [p.id, p]))
  const lines = body.items.map((i) => {
    const p = products.get(i.productId)
    return p && p.is_active ? { product: p, quantity: i.quantity, total: p.price_cents * i.quantity } : null
  })
  if (lines.some((l) => l === null)) return NextResponse.json({ error: 'product_unavailable' }, { status: 400 })
  const valid = lines as NonNullable<(typeof lines)[number]>[]
  const short = valid.find((l) => l.product.stock < l.quantity)
  if (short) return NextResponse.json({ error: 'out_of_stock', product: short.product.name }, { status: 409 })
  const totalCents = valid.reduce((sum, l) => sum + l.total, 0)
  if (totalCents <= 0) return NextResponse.json({ error: 'no_price', hint: 'Set shop prices in the admin first' }, { status: 400 })

  const description = valid.map((l) => `${l.quantity}× ${l.product.name}${l.product.variant ? ` ${l.product.variant}` : ''}`).join(', ')
  const { data: payment, error: payErr } = await admin
    .from('payments')
    .insert({
      user_id: body.memberId ?? null,
      amount_cents: totalCents,
      currency: 'TTD',
      status: body.method === 'cash' ? 'succeeded' : 'pending',
      kind: 'one_time',
      payment_method: body.method === 'cash' ? 'cash' : 'wam_online',
      recorded_by: s.id,
      paid_at: body.method === 'cash' ? new Date().toISOString() : null,
      metadata: { shop: true, description, soldBy: s.id, viaKiosk: true },
    })
    .select('id')
    .single()
  if (payErr || !payment) return NextResponse.json({ error: 'payment_failed' }, { status: 500 })
  const paymentId = (payment as { id: string }).id

  // Record the sale lines + stock now; a Wam sale that never pays gets
  // reversed by the admin (stock back) — rare at a front desk.
  for (const l of valid) {
    await admin.from('sales').insert({
      product_id: l.product.id,
      quantity: l.quantity,
      unit_cents: l.product.price_cents,
      total_cents: l.total,
      user_id: body.memberId ?? null,
      payment_id: paymentId,
      payment_method: body.method === 'cash' ? 'cash' : 'wam_online',
      sold_by: s.id,
    })
    await admin.from('stock_moves').insert({ product_id: l.product.id, delta: -l.quantity, reason: 'sale', created_by: s.id })
  }

  if (body.method === 'cash') {
    return NextResponse.json({ status: 'paid', paymentId, totalCents })
  }

  try {
    const intent = await getWam().createPaymentIntent({
      amountCents: totalCents,
      currency: 'TTD',
      orderReference: `shop-${paymentId}`,
      description: `Pinnacle shop: ${description}`.slice(0, 200),
      returnUrl: `${getSiteUrl()}/checkin`,
      metadata: { paymentId, kind: 'one_time', shop: 'true' },
    })
    await admin.from('payments').update({ wam_payment_id: intent.paymentId }).eq('id', paymentId)
    return NextResponse.json({ status: 'pending', paymentId, totalCents, checkoutUrl: intent.checkoutUrl })
  } catch (err) {
    console.error('[checkin/shop] wam intent failed:', err)
    await admin.from('payments').update({ status: 'failed', failure_reason: 'wam_intent_failed' }).eq('id', paymentId)
    return NextResponse.json({ error: 'wam_unavailable' }, { status: 502 })
  }
}
