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

export type CodeActionResult = { ok: true } | { ok: false; error: string }

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Code must be at least 3 characters')
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers and dashes only'),
  percentOff: z.number().int().min(1).max(100),
  maxUsesPerMember: z.number().int().min(1).max(1000).nullable(),
  expiresAt: z
    .string()
    .max(40)
    .nullable()
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), {
      message: 'Invalid end date',
    }),
  items: z
    .array(
      z.object({
        kind: z.enum(['plan', 'pass']),
        id: z.string().min(1).max(60),
      })
    )
    .max(50),
})

export async function adminCreateDiscountCode(
  input: z.infer<typeof createSchema>
): Promise<CodeActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = createSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('discount_codes').insert({
    code: data.code.toUpperCase(),
    percent_off: data.percentOff,
    applies_to: data.items,
    max_uses_per_member: data.maxUsesPerMember,
    expires_at: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
    created_by: auth.adminId,
  })
  if (error) {
    const isDupe = (error as { code?: string }).code === '23505'
    return {
      ok: false,
      error: isDupe ? 'That code already exists.' : 'Could not create code',
    }
  }
  revalidatePath('/admin/catalog/codes')
  return { ok: true }
}

export async function adminSetDiscountCodeActive(input: {
  codeId: string
  isActive: boolean
}): Promise<CodeActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!z.string().uuid().safeParse(input.codeId).success) {
    return { ok: false, error: 'Invalid code' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('discount_codes')
    .update({ is_active: input.isActive })
    .eq('id', input.codeId)
  if (error) return { ok: false, error: 'Could not update code' }
  revalidatePath('/admin/catalog/codes')
  return { ok: true }
}

export async function adminDeleteDiscountCode(input: {
  codeId: string
}): Promise<CodeActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!z.string().uuid().safeParse(input.codeId).success) {
    return { ok: false, error: 'Invalid code' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('discount_codes')
    .delete()
    .eq('id', input.codeId)
  if (error) return { ok: false, error: 'Could not delete code' }
  revalidatePath('/admin/catalog/codes')
  return { ok: true }
}

const updateSchema = createSchema.extend({
  codeId: z.string().uuid(),
})

export async function adminUpdateDiscountCode(
  input: z.infer<typeof updateSchema>
): Promise<CodeActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = updateSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('discount_codes')
    .update({
      code: data.code.toUpperCase(),
      percent_off: data.percentOff,
      applies_to: data.items,
      max_uses_per_member: data.maxUsesPerMember,
      expires_at: data.expiresAt
        ? new Date(data.expiresAt).toISOString()
        : null,
    })
    .eq('id', data.codeId)
  if (error) {
    const isDupe = (error as { code?: string }).code === '23505'
    return {
      ok: false,
      error: isDupe
        ? 'Another code already uses that name.'
        : 'Could not update code',
    }
  }
  revalidatePath('/admin/catalog/codes')
  return { ok: true }
}
