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

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')

const addSchema = z
  .object({
    label: z.string().trim().min(1, 'Give the expense a name').max(200),
    category: z.string().trim().min(1).max(60),
    amountCents: z.number().int().min(1, 'Enter an amount'),
    isRecurring: z.boolean(),
    incurredOn: dateField.optional().nullable(),
    startsOn: dateField.optional().nullable(),
    endsOn: dateField.optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((v) => (v.isRecurring ? !!v.startsOn : !!v.incurredOn), {
    message: 'Pick a date',
  })

export type ExpenseActionResult = { ok: true } | { ok: false; error: string }

export async function adminAddExpense(
  input: z.infer<typeof addSchema>
): Promise<ExpenseActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = addSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('expenses').insert({
    label: data.label,
    category: data.category,
    amount_cents: data.amountCents,
    is_recurring: data.isRecurring,
    incurred_on: data.isRecurring ? null : data.incurredOn,
    starts_on: data.isRecurring ? data.startsOn : null,
    ends_on: data.isRecurring ? (data.endsOn ?? null) : null,
    notes: data.notes?.trim() || null,
    created_by: auth.adminId,
  })
  if (error) {
    console.error('[finance] expense insert failed:', error)
    return { ok: false, error: 'Could not save the expense' }
  }
  revalidatePath('/admin/finance')
  return { ok: true }
}

export async function adminDeleteExpense(input: {
  expenseId: string
}): Promise<ExpenseActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!z.string().uuid().safeParse(input.expenseId).success) {
    return { ok: false, error: 'Invalid expense' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('expenses')
    .delete()
    .eq('id', input.expenseId)
  if (error) return { ok: false, error: 'Could not delete the expense' }
  revalidatePath('/admin/finance')
  return { ok: true }
}

// A recurring expense that has genuinely stopped gets an end date rather
// than a delete, so past months keep their true totals.
export async function adminEndRecurringExpense(input: {
  expenseId: string
  endsOn: string
}): Promise<ExpenseActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (
    !z.string().uuid().safeParse(input.expenseId).success ||
    !dateField.safeParse(input.endsOn).success
  ) {
    return { ok: false, error: 'Invalid input' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('expenses')
    .update({ ends_on: input.endsOn })
    .eq('id', input.expenseId)
    .eq('is_recurring', true)
  if (error) return { ok: false, error: 'Could not update the expense' }
  revalidatePath('/admin/finance')
  return { ok: true }
}
