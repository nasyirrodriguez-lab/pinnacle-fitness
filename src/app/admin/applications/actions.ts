'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  approveApplication,
  type ApplicationRow,
} from '@/lib/applications/approve'
import {
  sendDeclinedEmail,
  sendWaitlistedEmail,
} from '@/lib/applications/emails'

const TEAM_ROLES = new Set(['coach', 'owner', 'admin'])

async function assertTeam(): Promise<{ adminId: string } | { error: string }> {
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
  const role = (profile as { role?: string } | null)?.role ?? ''
  if (!TEAM_ROLES.has(role)) return { error: 'Coaches and owners only' }
  return { adminId: user.id }
}

export type ApplicationActionResult =
  | { ok: true }
  | { ok: false; error: string }

async function loadApplication(id: string): Promise<ApplicationRow | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('applications')
    .select(
      'id, full_name, email, phone, experience_bracket, training_now, goal, referred_by, plan_interest, status'
    )
    .eq('id', id)
    .maybeSingle()
  return (data as ApplicationRow | null) ?? null
}

const notesSchema = z.object({
  applicationId: z.string().uuid(),
  notes: z.string().trim().max(2000),
})

export async function saveApplicationNotes(
  input: z.infer<typeof notesSchema>
): Promise<ApplicationActionResult> {
  const auth = await assertTeam()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = notesSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid input' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('applications')
    .update({
      coach_notes: data.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.applicationId)
  if (error) return { ok: false, error: 'Could not save notes' }
  revalidatePath('/admin/applications')
  return { ok: true }
}

const statusSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(['intro_booked', 'waitlisted', 'declined', 'new']),
})

export async function setApplicationStatus(
  input: z.infer<typeof statusSchema>
): Promise<ApplicationActionResult> {
  const auth = await assertTeam()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = statusSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid input' }
  }
  const app = await loadApplication(data.applicationId)
  if (!app) return { ok: false, error: 'Application not found' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('applications')
    .update({ status: data.status, updated_at: new Date().toISOString() })
    .eq('id', app.id)
  if (error) return { ok: false, error: 'Could not update' }

  if (data.status === 'waitlisted' && app.status !== 'waitlisted') {
    await sendWaitlistedEmail({ to: app.email, fullName: app.full_name })
  }
  if (data.status === 'declined' && app.status !== 'declined') {
    await sendDeclinedEmail({ to: app.email, fullName: app.full_name })
  }
  revalidatePath('/admin/applications')
  return { ok: true }
}

const approveSchema = z.object({
  applicationId: z.string().uuid(),
  planId: z.string().max(60).nullable(),
})

export async function approveApplicationAction(
  input: z.infer<typeof approveSchema>
): Promise<ApplicationActionResult> {
  const auth = await assertTeam()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = approveSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid input' }
  }
  const app = await loadApplication(data.applicationId)
  if (!app) return { ok: false, error: 'Application not found' }
  if (['approved', 'invited'].includes(app.status)) {
    return { ok: false, error: 'Already approved' }
  }
  const result = await approveApplication(createAdminClient(), {
    application: app,
    adminId: auth.adminId,
    planId: data.planId,
    fromWaitlist: app.status === 'waitlisted',
  })
  if (!result.ok) return result
  revalidatePath('/admin/applications')
  revalidatePath('/admin/members')
  return { ok: true }
}

// Slow month: open the list and invite the next N, oldest first.
const bulkSchema = z.object({ count: z.number().int().min(1).max(50) })

export async function inviteFromWaitlist(
  input: z.infer<typeof bulkSchema>
): Promise<{ ok: true; invited: number } | { ok: false; error: string }> {
  const auth = await assertTeam()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = bulkSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid input' }
  }
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('applications')
    .select(
      'id, full_name, email, phone, experience_bracket, training_now, goal, referred_by, plan_interest, status'
    )
    .eq('status', 'waitlisted')
    .order('created_at', { ascending: true })
    .limit(data.count)
  let invited = 0
  for (const app of (rows as ApplicationRow[] | null) ?? []) {
    const r = await approveApplication(admin, {
      application: app,
      adminId: auth.adminId,
      planId: null,
      fromWaitlist: true,
    })
    if (r.ok) invited++
  }
  revalidatePath('/admin/applications')
  return { ok: true, invited }
}

export async function deleteApplication(input: {
  applicationId: string
}): Promise<ApplicationActionResult> {
  const auth = await assertTeam()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!z.string().uuid().safeParse(input.applicationId).success) {
    return { ok: false, error: 'Invalid input' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('applications')
    .delete()
    .eq('id', input.applicationId)
    .in('status', ['screened_out', 'declined'])
  if (error) return { ok: false, error: 'Could not delete' }
  revalidatePath('/admin/applications')
  return { ok: true }
}
