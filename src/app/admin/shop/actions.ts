'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/utils/supabase/admin'
import { assertOwner } from '@/lib/auth/assert'

export type ShopActionResult = { ok: true } | { ok: false; error: string }

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  variant: z.string().trim().max(60).optional().nullable(),
  priceCents: z.number().int().min(0).max(100_000_000),
  isActive: z.boolean(),
})

export async function adminSaveProduct(input: z.infer<typeof productSchema>): Promise<ShopActionResult> {
  const auth = await assertOwner()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = productSchema.parse(input)
  } catch {
    return { ok: false, error: 'Name and a price, please' }
  }
  const admin = createAdminClient()
  const row = { name: data.name, variant: data.variant?.trim() ?? '', price_cents: data.priceCents, is_active: data.isActive }
  const { error } = data.id
    ? await admin.from('products').update(row).eq('id', data.id)
    : await admin.from('products').insert(row)
  if (error) {
    const dupe = (error as { code?: string }).code === '23505'
    return { ok: false, error: dupe ? 'That product + variant already exists' : 'Could not save' }
  }
  revalidatePath('/admin/shop')
  return { ok: true }
}

const restockSchema = z.object({
  productId: z.string().uuid(),
  delta: z.number().int().refine((n) => n !== 0, 'Enter a quantity'),
  reason: z.enum(['restock', 'adjust']),
})

export async function adminRestock(input: z.infer<typeof restockSchema>): Promise<ShopActionResult> {
  const auth = await assertOwner()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = restockSchema.parse(input)
  } catch {
    return { ok: false, error: 'Enter a quantity' }
  }
  const admin = createAdminClient()
  const { error } = await admin.from('stock_moves').insert({ product_id: data.productId, delta: data.delta, reason: data.reason, created_by: auth.adminId })
  if (error) return { ok: false, error: 'Could not update stock' }
  revalidatePath('/admin/shop')
  return { ok: true }
}
