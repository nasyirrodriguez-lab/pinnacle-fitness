'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isOwner } from '@/lib/auth/roles'
import { createInvoice } from '@/lib/invoices/create'
import {
  invoiceMonthlyRenters,
  type MonthlyInvoicingResult,
} from '@/lib/invoices/monthly'

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
  if (!profile || !isOwner((profile as { role?: string }).role)) {
    return { error: 'Owners only' }
  }
  return { adminId: user.id }
}

const createSchema = z.object({
  email: z.string().email('Enter the member email'),
  kind: z.enum([
    'virtual_office',
    'office_rental',
    'membership',
    'booking',
    'other',
  ]),
  lineItems: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        amountCents: z.number().int().min(0).max(100_000_000),
      })
    )
    .min(1, 'Add at least one line item')
    .max(20),
  periodLabel: z.string().trim().max(60).optional(),
  dueAt: z
    .string()
    .max(40)
    .optional()
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), {
      message: 'Invalid due date',
    }),
  renewsMembership: z.boolean().default(false),
})

export type AdminInvoiceResult =
  | { ok: true; number: string }
  | { ok: false; error: string }

export async function adminCreateInvoice(
  input: z.infer<typeof createSchema>
): Promise<AdminInvoiceResult> {
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
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', data.email.toLowerCase().trim())
    .maybeSingle()
  if (!profile) return { ok: false, error: 'No member with that email' }
  const userId = (profile as { id: string }).id

  // When the invoice renews their membership, paying it extends the
  // plan they already hold.
  let planId: string | null = null
  if (data.renewsMembership) {
    const { data: subRows } = await admin
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', userId)
      .in('status', ['active', 'past_due', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1)
    planId = (subRows as { plan_id: string }[] | null)?.[0]?.plan_id ?? null
    if (!planId) {
      return {
        ok: false,
        error:
          'This member has no membership to renew — untick "renews membership" or set one up first.',
      }
    }
  }

  const result = await createInvoice(admin, {
    userId,
    kind: data.kind,
    lineItems: data.lineItems,
    periodLabel: data.periodLabel || null,
    dueAt: data.dueAt ? new Date(data.dueAt).toISOString() : null,
    planId,
    createdBy: auth.adminId,
  })
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/admin/invoices')
  return { ok: true, number: result.number }
}

export async function adminRunMonthlyInvoicing(): Promise<
  { ok: true; result: MonthlyInvoicingResult } | { ok: false; error: string }
> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  const result = await invoiceMonthlyRenters(createAdminClient())
  revalidatePath('/admin/invoices')
  return { ok: true, result }
}
