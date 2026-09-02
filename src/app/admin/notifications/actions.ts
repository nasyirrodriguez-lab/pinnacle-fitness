'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isOwner } from '@/lib/auth/roles'
import { sendMemberNotification } from '@/lib/notifications/notify'
import { sendBroadcast } from '@/lib/email/broadcast'

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

const sendSchema = z.object({
  title: z.string().trim().min(1, 'A subject is required').max(150),
  body: z.string().trim().min(1, 'A message is required').max(5000),
  // Blank = broadcast to every member; otherwise resolve by email.
  recipientEmail: z
    .string()
    .email('Enter a valid member email, or leave blank for everyone')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export type SendNotificationResult =
  | { ok: true; audience: string }
  | { ok: false; error: string }

export async function adminSendNotification(
  input: z.infer<typeof sendSchema>
): Promise<SendNotificationResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = sendSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()

  let userId: string | null = null
  let audience = 'all members'
  if (data.recipientEmail) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', data.recipientEmail.toLowerCase().trim())
      .maybeSingle()
    if (!profile) {
      return { ok: false, error: 'No member with that email.' }
    }
    const p = profile as { id: string; full_name: string | null; email: string }
    userId = p.id
    audience = p.full_name?.trim() || p.email
  }

  const result = await sendMemberNotification(admin, {
    userId,
    title: data.title,
    body: data.body,
    createdBy: auth.adminId,
  })
  if (!result.ok) return { ok: false, error: result.error }

  // Messages also go out by email so members hear about them without
  // opening the dashboard. The unique template key ties the email to
  // this exact message, so re-sends of a new message never dedup away.
  const recipients = data.recipientEmail
    ? await loadRecipientsByIds(admin, userId ? [userId] : [])
    : await loadAllMemberRecipients(admin)
  await sendBroadcast({
    admin,
    input: {
      subject: data.title,
      bodyMarkdown: data.body,
      recipients,
      template: `message:${result.id}`,
    },
  })

  revalidatePath('/admin/notifications')
  revalidatePath('/dashboard/messages')
  revalidatePath('/dashboard')
  return { ok: true, audience }
}

async function loadAllMemberRecipients(
  admin: ReturnType<typeof createAdminClient>
) {
  const { data } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .eq('archived', false)
    .not('email', 'is', null)
  return (
    (data as
      | { id: string; email: string; full_name: string | null }[]
      | null) ?? []
  ).map((p) => ({ userId: p.id, email: p.email, fullName: p.full_name }))
}

async function loadRecipientsByIds(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[]
) {
  if (userIds.length === 0) return []
  const { data } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)
  return (
    (data as
      | { id: string; email: string; full_name: string | null }[]
      | null) ?? []
  ).map((p) => ({ userId: p.id, email: p.email, fullName: p.full_name }))
}

// =====================================================================
// Message groups — named member lists for targeted sends.
// =====================================================================

export async function adminCreateMessageGroup(input: {
  name: string
}): Promise<SendNotificationResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  const name = input.name.trim()
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: 'Give the group a name (2–80 characters)' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('message_groups')
    .insert({ name, created_by: auth.adminId })
  if (error) {
    const isDupe = (error as { code?: string }).code === '23505'
    return {
      ok: false,
      error: isDupe
        ? 'A group with that name exists.'
        : 'Could not create group',
    }
  }
  revalidatePath('/admin/notifications')
  return { ok: true, audience: name }
}

export async function adminDeleteMessageGroup(input: {
  groupId: string
}): Promise<SendNotificationResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!z.string().uuid().safeParse(input.groupId).success) {
    return { ok: false, error: 'Invalid group' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('message_groups')
    .delete()
    .eq('id', input.groupId)
  if (error) return { ok: false, error: 'Could not delete group' }
  revalidatePath('/admin/notifications')
  return { ok: true, audience: '' }
}

export async function adminAddGroupMember(input: {
  groupId: string
  email: string
}): Promise<SendNotificationResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (
    !z.string().uuid().safeParse(input.groupId).success ||
    !z.string().email().safeParse(input.email.trim()).success
  ) {
    return { ok: false, error: 'Enter a valid member email' }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', input.email.toLowerCase().trim())
    .maybeSingle()
  if (!profile) return { ok: false, error: 'No member with that email.' }

  const { error } = await admin.from('message_group_members').upsert(
    {
      group_id: input.groupId,
      user_id: (profile as { id: string }).id,
    },
    { onConflict: 'group_id,user_id', ignoreDuplicates: true }
  )
  if (error) return { ok: false, error: 'Could not add member' }
  revalidatePath('/admin/notifications')
  return { ok: true, audience: '' }
}

export async function adminRemoveGroupMember(input: {
  groupId: string
  userId: string
}): Promise<SendNotificationResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (
    !z.string().uuid().safeParse(input.groupId).success ||
    !z.string().uuid().safeParse(input.userId).success
  ) {
    return { ok: false, error: 'Invalid input' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('message_group_members')
    .delete()
    .eq('group_id', input.groupId)
    .eq('user_id', input.userId)
  if (error) return { ok: false, error: 'Could not remove member' }
  revalidatePath('/admin/notifications')
  return { ok: true, audience: '' }
}

const groupSendSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().trim().min(1, 'A subject is required').max(150),
  body: z.string().trim().min(1, 'A message is required').max(5000),
})

export async function adminSendToGroup(
  input: z.infer<typeof groupSendSchema>
): Promise<SendNotificationResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = groupSendSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const [{ data: group }, { data: members }] = await Promise.all([
    admin
      .from('message_groups')
      .select('name')
      .eq('id', data.groupId)
      .maybeSingle(),
    admin
      .from('message_group_members')
      .select('user_id')
      .eq('group_id', data.groupId),
  ])
  if (!group) return { ok: false, error: 'Group not found' }
  const userIds = ((members as { user_id: string }[] | null) ?? []).map(
    (m) => m.user_id
  )
  if (userIds.length === 0) {
    return { ok: false, error: 'That group has no members yet.' }
  }

  // Fan out one direct message per member so reads track individually.
  let firstMessageId: string | null = null
  for (const userId of userIds) {
    const result = await sendMemberNotification(admin, {
      userId,
      title: data.title,
      body: data.body,
      createdBy: auth.adminId,
    })
    if (!result.ok) return { ok: false, error: result.error }
    if (!firstMessageId) firstMessageId = result.id
  }

  await sendBroadcast({
    admin,
    input: {
      subject: data.title,
      bodyMarkdown: data.body,
      recipients: await loadRecipientsByIds(admin, userIds),
      template: `message:${firstMessageId ?? data.groupId}`,
    },
  })

  revalidatePath('/admin/notifications')
  revalidatePath('/dashboard/messages')
  revalidatePath('/dashboard')
  return {
    ok: true,
    audience: `${(group as { name: string }).name} (${userIds.length} member${userIds.length === 1 ? '' : 's'})`,
  }
}
