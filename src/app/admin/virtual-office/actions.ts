'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendVirtualOfficeMailNotification } from '@/lib/email/virtual-office'
import { VO_AGREEMENT_VERSION } from '@/config/virtual-office'

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

export type AdminVOResult = { ok: true } | { ok: false; error: string }

const logMailSchema = z.object({
  userId: z.string().uuid(),
  sender: z.string().max(200).optional(),
  label: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  photoUrl: z
    .string()
    .url('Photo URL must be a valid URL')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export async function adminLogMail(
  input: z.infer<typeof logMailSchema>
): Promise<AdminVOResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = logMailSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()

  // Confirm the user actually has a VO subscription (active or not).
  const { data: vo } = await admin
    .from('virtual_office_subscriptions')
    .select('id, is_active, business_name, forwarding_email')
    .eq('user_id', data.userId)
    .maybeSingle()
  if (!vo) {
    return {
      ok: false,
      error: 'That user does not have a Virtual Office subscription',
    }
  }

  const { data: mailRow, error: insertErr } = await admin
    .from('virtual_office_mail')
    .insert({
      user_id: data.userId,
      sender: data.sender || null,
      label: data.label || null,
      notes: data.notes || null,
      photo_url: data.photoUrl || null,
      created_by: auth.adminId,
    })
    .select('id')
    .single()

  if (insertErr || !mailRow) {
    console.error('[admin/vo/logMail] insert failed:', insertErr)
    return { ok: false, error: 'Could not log mail item' }
  }

  // Look up the recipient profile email for notification
  const { data: profile } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', data.userId)
    .maybeSingle()
  const recipientEmail =
    (vo as { forwarding_email: string | null }).forwarding_email ||
    (profile as { email?: string })?.email ||
    null

  if (recipientEmail) {
    try {
      await sendVirtualOfficeMailNotification({
        to: recipientEmail,
        recipientName: (profile as { full_name?: string })?.full_name ?? null,
        businessName: (vo as { business_name: string }).business_name,
        sender: data.sender ?? null,
        label: data.label ?? null,
      })
      await admin
        .from('virtual_office_mail')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', (mailRow as { id: string }).id)
    } catch (err) {
      console.error('[admin/vo/logMail] notification failed:', err)
      // Don't fail the action — the mail item is logged either way.
    }
  }

  revalidatePath('/admin/virtual-office')
  revalidatePath(`/admin/virtual-office/${data.userId}`)
  revalidatePath('/dashboard/mail')
  return { ok: true }
}

// =====================================================================
// Admin-side VO setup — for members who signed up on paper or pay at
// the front desk instead of the self-serve /virtual-office flow. The
// self-serve flow is the only other place these rows get created.
// =====================================================================

const createVoSchema = z.object({
  userId: z.string().uuid(),
  businessName: z.string().trim().min(1, 'Business name is required').max(200),
  forwardingEmail: z
    .string()
    .email('Forwarding email must be a valid email')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export async function adminCreateVirtualOffice(
  input: z.infer<typeof createVoSchema>
): Promise<AdminVOResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = createVoSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('virtual_office_subscriptions')
    .select('id')
    .eq('user_id', data.userId)
    .maybeSingle()
  if (existing) {
    return {
      ok: false,
      error: 'This member already has a virtual office on file.',
    }
  }

  // Link the member's VO subscription if they hold one, so billing and
  // the mail dashboard trace to the same record.
  const { data: subRows } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', data.userId)
    .eq('plan_id', 'virtual-office-monthly')
    .in('status', ['active', 'past_due', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
  const subscriptionId = (subRows as { id: string }[] | null)?.[0]?.id ?? null

  const { error } = await admin.from('virtual_office_subscriptions').insert({
    user_id: data.userId,
    subscription_id: subscriptionId,
    business_name: data.businessName,
    forwarding_email: data.forwardingEmail ?? null,
    agreement_version: VO_AGREEMENT_VERSION,
    is_active: true,
  })
  if (error) {
    console.error('[admin/vo/create] insert failed:', error)
    return { ok: false, error: 'Could not set up the virtual office' }
  }

  revalidatePath(`/admin/members/${data.userId}`)
  revalidatePath('/admin/virtual-office')
  revalidatePath(`/admin/virtual-office/${data.userId}`)
  return { ok: true }
}

const setVoActiveSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
})

export async function adminSetVirtualOfficeActive(
  input: z.infer<typeof setVoActiveSchema>
): Promise<AdminVOResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = setVoActiveSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid input' }
  }

  const admin = createAdminClient()
  const { error, count } = await admin
    .from('virtual_office_subscriptions')
    .update({ is_active: data.isActive }, { count: 'exact' })
    .eq('user_id', data.userId)
  if (error || (count ?? 0) === 0) {
    return { ok: false, error: 'No virtual office on file for this member' }
  }

  revalidatePath(`/admin/members/${data.userId}`)
  revalidatePath('/admin/virtual-office')
  revalidatePath(`/admin/virtual-office/${data.userId}`)
  return { ok: true }
}

const reviewDocSchema = z.object({
  documentId: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
  note: z.string().max(500).optional(),
})

export async function adminReviewVoDocument(
  input: z.infer<typeof reviewDocSchema>
): Promise<AdminVOResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = reviewDocSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid input' }
  }

  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from('virtual_office_documents')
    .update({
      status: data.status,
      review_note: data.note?.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.adminId,
    })
    .eq('id', data.documentId)
    .select('user_id')
    .maybeSingle()
  if (error || !updated) {
    console.error('[admin/vo/reviewDoc] update failed:', error)
    return { ok: false, error: 'Could not save review' }
  }

  // Revalidating the detail page the admin is on is what makes the
  // status chip flip in the same round trip — without it the update
  // lands in the DB but the screen never changes.
  const userId = (updated as { user_id: string }).user_id
  revalidatePath('/admin/virtual-office')
  revalidatePath(`/admin/virtual-office/${userId}`)
  revalidatePath('/virtual-office')
  return { ok: true }
}

const setStatusSchema = z.object({
  mailId: z.string().uuid(),
  status: z.enum(['received', 'collected', 'forwarded', 'discarded']),
})

export async function adminSetMailStatus(
  input: z.infer<typeof setStatusSchema>
): Promise<AdminVOResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = setStatusSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid input' }
  }

  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from('virtual_office_mail')
    .update({
      status: data.status,
      status_changed_at: new Date().toISOString(),
    })
    .eq('id', data.mailId)
    .select('user_id')
    .maybeSingle()
  if (error || !updated) return { ok: false, error: 'Update failed' }

  revalidatePath('/admin/virtual-office')
  revalidatePath(
    `/admin/virtual-office/${(updated as { user_id: string }).user_id}`
  )
  revalidatePath('/dashboard/mail')
  return { ok: true }
}
