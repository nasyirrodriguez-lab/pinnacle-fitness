'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

async function assertAdmin(): Promise<{ adminId: string } | { error: string }> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || (profile as { role?: string }).role !== 'admin') {
    return { error: 'Admin only' }
  }
  return { adminId: user.id }
}

export type AdminActionResult = { ok: true } | { ok: false; error: string }

// Client splits the textarea on newlines before sending. Server accepts
// the pre-split array.
const featuresField = z.array(z.string().max(200)).max(50)

// Discount fields shared by plans and passes. Empty strings from the
// client mean "no discount" and normalize to null.
const discountExpiresField = z
  .string()
  .max(40)
  .nullable()
  .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), {
    message: 'Invalid discount end date',
  })
const discountLabelField = z.string().max(80).nullable()

const planSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  priceCents: z.number().int().min(0),
  discountedPriceCents: z.number().int().min(0).nullable(),
  discountExpiresAt: discountExpiresField,
  discountLabel: discountLabelField,
  features: featuresField,
  isActive: z.boolean(),
  isPrivate: z.boolean(),
  isSpecialized: z.boolean().default(false),
  groupSize: z.number().int().min(2).max(50).nullable().default(null),
  includesDayAccess: z.boolean().default(true),
  roomBenefits: z
    .array(
      z
        .object({
          resourceId: z.string().min(1).max(60),
          unit: z.enum(['minutes', 'hours', 'days', 'months']),
          amount: z.number().min(0.5),
          maxHoursPerDay: z.number().min(0.5).max(24).nullable(),
        })
        .refine(
          (b) => {
            const max = {
              minutes: 10_000,
              hours: 500,
              days: 30,
              months: 12,
            }[b.unit]
            return b.amount <= max
          },
          { message: 'Amount too large for that unit (days max 30)' }
        )
    )
    .max(20)
    .default([]),
})

export async function updatePlan(
  input: z.infer<typeof planSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = planSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('plans')
    .update({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      price_cents: data.priceCents,
      discounted_price_cents: data.discountedPriceCents,
      discount_expires_at: data.discountExpiresAt
        ? new Date(data.discountExpiresAt).toISOString()
        : null,
      discount_label: data.discountLabel?.trim() || null,
      features: data.features,
      is_active: data.isActive,
      is_private: data.isPrivate,
      is_specialized: data.isSpecialized,
      group_size: data.groupSize,
      includes_day_access: data.includesDayAccess,
      room_benefits: data.roomBenefits,
    })
    .eq('id', data.id)

  if (error) {
    console.error('[admin/updatePlan] failed:', error)
    return { ok: false, error: 'Could not save plan' }
  }

  revalidatePath('/admin/catalog')
  revalidatePath(`/admin/catalog/plans/${data.id}`)
  revalidatePath('/pricing')
  return { ok: true }
}

const passSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  priceCents: z.number().int().min(0),
  discountedPriceCents: z.number().int().min(0).nullable(),
  discountExpiresAt: discountExpiresField,
  discountLabel: discountLabelField,
  usesTotal: z.number().int().min(1).max(365),
  validityDays: z.number().int().min(1).max(3650),
  features: featuresField,
  isActive: z.boolean(),
  isPrivate: z.boolean(),
  isSpecialized: z.boolean().default(false),
  groupSize: z.number().int().min(2).max(50).nullable().default(null),
})

export async function updatePass(
  input: z.infer<typeof passSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = passSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('passes')
    .update({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      price_cents: data.priceCents,
      discounted_price_cents: data.discountedPriceCents,
      discount_expires_at: data.discountExpiresAt
        ? new Date(data.discountExpiresAt).toISOString()
        : null,
      discount_label: data.discountLabel?.trim() || null,
      uses_total: data.usesTotal,
      validity_days: data.validityDays,
      features: data.features,
      is_active: data.isActive,
      is_private: data.isPrivate,
      is_specialized: data.isSpecialized,
      group_size: data.groupSize,
    })
    .eq('id', data.id)

  if (error) {
    console.error('[admin/updatePass] failed:', error)
    return { ok: false, error: 'Could not save pass' }
  }

  revalidatePath('/admin/catalog')
  revalidatePath(`/admin/catalog/passes/${data.id}`)
  revalidatePath('/pricing')
  revalidatePath('/buy')
  return { ok: true }
}

// =====================================================================
// Create — a new plan/pass starts as an inactive shell with just an id
// and name; the admin fills in pricing on the edit page before flipping
// it active. Keeps the create step tiny and the edit page canonical.
// =====================================================================

const slugField = z
  .string()
  .min(2)
  .max(60)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and dashes (e.g. "team-day-pass")'
  )

const createProductSchema = z.object({
  kind: z.enum(['plan', 'pass']),
  id: slugField,
  name: z.string().min(1).max(120),
})

export type CreateProductResult =
  | { ok: true; href: string }
  | { ok: false; error: string }

export async function createProduct(
  input: z.infer<typeof createProductSchema>
): Promise<CreateProductResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = createProductSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const table = data.kind === 'plan' ? 'plans' : 'passes'
  const { data: existing } = await admin
    .from(table)
    .select('id')
    .eq('id', data.id)
    .maybeSingle()
  if (existing) {
    return { ok: false, error: `A ${data.kind} with id "${data.id}" exists.` }
  }

  const row: Record<string, unknown> = {
    id: data.id,
    name: data.name.trim(),
    price_cents: 0,
    is_active: false,
    display_order: 99,
  }
  if (data.kind === 'pass') {
    row.uses_total = 1
    row.validity_days = 365
  }
  const { error } = await admin.from(table).insert(row)
  if (error) {
    console.error('[admin/createProduct] failed:', error)
    return { ok: false, error: `Could not create ${data.kind}` }
  }

  revalidatePath('/admin/catalog')
  return {
    ok: true,
    href: `/admin/catalog/${data.kind === 'plan' ? 'plans' : 'passes'}/${data.id}`,
  }
}

// =====================================================================
// Bulk discounts — one campaign (label + % off + end date) applied to
// any mix of plans and passes at once. "Full Bloom" and friends.
// =====================================================================

const discountItemsField = z
  .array(
    z.object({
      kind: z.enum(['plan', 'pass']),
      id: z.string().min(1).max(60),
    })
  )
  .min(1, 'Pick at least one plan or pass')
  .max(50)

const applyDiscountSchema = z.object({
  items: discountItemsField,
  percentOff: z.number().int().min(1).max(95),
  label: z.string().trim().min(1, 'Give the discount a name').max(80),
  expiresAt: z
    .string()
    .max(40)
    .nullable()
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), {
      message: 'Invalid end date',
    }),
})

export async function applyCatalogDiscount(
  input: z.infer<typeof applyDiscountSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = applyDiscountSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const expiresIso = data.expiresAt
    ? new Date(data.expiresAt).toISOString()
    : null

  for (const item of data.items) {
    const table = item.kind === 'plan' ? 'plans' : 'passes'
    const { data: row } = await admin
      .from(table)
      .select('price_cents')
      .eq('id', item.id)
      .maybeSingle()
    if (!row) continue
    const base = (row as { price_cents: number }).price_cents
    const discounted = Math.round((base * (100 - data.percentOff)) / 100)
    const { error } = await admin
      .from(table)
      .update({
        discounted_price_cents: discounted,
        discount_expires_at: expiresIso,
        discount_label: data.label,
      })
      .eq('id', item.id)
    if (error) {
      console.error('[admin/applyDiscount] failed:', item, error)
      return { ok: false, error: `Could not discount ${item.id}` }
    }
  }

  revalidatePath('/admin/catalog')
  revalidatePath('/pricing')
  revalidatePath('/buy')
  return { ok: true }
}

export async function clearCatalogDiscount(input: {
  items: z.infer<typeof discountItemsField>
}): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let items
  try {
    items = discountItemsField.parse(input.items)
  } catch {
    return { ok: false, error: 'Pick at least one plan or pass' }
  }

  const admin = createAdminClient()
  for (const item of items) {
    const table = item.kind === 'plan' ? 'plans' : 'passes'
    const { error } = await admin
      .from(table)
      .update({
        discounted_price_cents: null,
        discount_expires_at: null,
        discount_label: null,
      })
      .eq('id', item.id)
    if (error) {
      console.error('[admin/clearDiscount] failed:', item, error)
      return { ok: false, error: `Could not clear discount on ${item.id}` }
    }
  }

  revalidatePath('/admin/catalog')
  revalidatePath('/pricing')
  revalidatePath('/buy')
  return { ok: true }
}

const resourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  capacity: z.number().int().min(1).max(500),
  pricePerHourCents: z.number().int().min(0).nullable(),
  openHour: z.number().int().min(0).max(23),
  closeHour: z.number().int().min(1).max(24),
  slotMinutes: z.number().int().min(15).max(240),
  isBookable: z.boolean(),
  requiresContact: z.boolean(),
})

export async function updateResource(
  input: z.infer<typeof resourceSchema>
): Promise<AdminActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = resourceSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }
  if (data.closeHour <= data.openHour) {
    return {
      ok: false,
      error: 'Close hour must be after open hour',
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('resources')
    .update({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      capacity: data.capacity,
      price_per_hour_cents: data.pricePerHourCents,
      open_hour: data.openHour,
      close_hour: data.closeHour,
      slot_minutes: data.slotMinutes,
      is_bookable: data.isBookable,
      requires_contact: data.requiresContact,
    })
    .eq('id', data.id)

  if (error) {
    console.error('[admin/updateResource] failed:', error)
    return { ok: false, error: 'Could not save resource' }
  }

  revalidatePath('/admin/catalog')
  revalidatePath(`/admin/catalog/resources/${data.id}`)
  revalidatePath('/pricing')
  revalidatePath('/book')
  revalidatePath(`/book/${data.id}`)
  return { ok: true }
}

// =====================================================================
// Delete a plan/pass. Products with sales history can't be hard-deleted
// (subscriptions and pass purchases reference them) — those get retired
// instead: pulled off sale everywhere but kept for the records.
// =====================================================================

export type DeleteProductResult =
  | { ok: true; outcome: 'deleted' | 'retired' }
  | { ok: false; error: string }

export async function deleteProduct(input: {
  kind: 'plan' | 'pass'
  id: string
}): Promise<DeleteProductResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (
    (input.kind !== 'plan' && input.kind !== 'pass') ||
    typeof input.id !== 'string' ||
    input.id.length === 0 ||
    input.id.length > 60
  ) {
    return { ok: false, error: 'Invalid product' }
  }

  const admin = createAdminClient()
  const table = input.kind === 'plan' ? 'plans' : 'passes'

  const { error: deleteErr } = await admin
    .from(table)
    .delete()
    .eq('id', input.id)

  if (!deleteErr) {
    revalidatePath('/admin/catalog')
    revalidatePath('/pricing')
    revalidatePath('/buy')
    return { ok: true, outcome: 'deleted' }
  }

  const hasHistory = (deleteErr as { code?: string }).code === '23503'
  if (!hasHistory) {
    console.error('[admin/deleteProduct] failed:', deleteErr)
    return { ok: false, error: `Could not delete ${input.kind}` }
  }

  const { error: retireErr } = await admin
    .from(table)
    .update({ is_active: false, is_private: true })
    .eq('id', input.id)
  if (retireErr) {
    console.error('[admin/deleteProduct] retire failed:', retireErr)
    return { ok: false, error: `Could not retire ${input.kind}` }
  }

  revalidatePath('/admin/catalog')
  revalidatePath('/pricing')
  revalidatePath('/buy')
  return { ok: true, outcome: 'retired' }
}
