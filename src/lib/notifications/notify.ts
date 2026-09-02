import type { SupabaseClient } from '@supabase/supabase-js'

// In-app member notifications — the "messages" system that replaces
// email broadcast for day-to-day comms. A null userId broadcasts to
// every member; reads are tracked per member in
// member_notification_reads.

export interface MemberNotification {
  id: string
  userId: string | null
  title: string
  body: string
  sender: 'team' | 'member'
  createdAt: string
  read: boolean
}

export async function sendMemberNotification(
  admin: SupabaseClient,
  args: {
    userId: string | null
    title: string
    body: string
    createdBy: string | null
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from('member_notifications')
    .insert({
      user_id: args.userId,
      title: args.title.trim(),
      body: args.body.trim(),
      created_by: args.createdBy,
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[notifications] insert failed:', error)
    return { ok: false, error: 'Could not send the message' }
  }
  return { ok: true, id: (data as { id: string }).id }
}

export async function listNotificationsFor(
  client: SupabaseClient,
  userId: string,
  limit = 50
): Promise<MemberNotification[]> {
  const [{ data: rows }, { data: readRows }] = await Promise.all([
    client
      .from('member_notifications')
      .select('id, user_id, title, body, sender, created_at')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(limit),
    client
      .from('member_notification_reads')
      .select('notification_id')
      .eq('user_id', userId),
  ])
  const readIds = new Set(
    ((readRows as { notification_id: string }[] | null) ?? []).map(
      (r) => r.notification_id
    )
  )
  return ((rows as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: r.id as string,
    userId: (r.user_id as string | null) ?? null,
    title: r.title as string,
    body: r.body as string,
    sender: ((r.sender as string) ?? 'team') as 'team' | 'member',
    createdAt: r.created_at as string,
    read: readIds.has(r.id as string),
  }))
}

export async function unreadNotificationCount(
  client: SupabaseClient,
  userId: string
): Promise<number> {
  const notifications = await listNotificationsFor(client, userId, 100)
  // A member's own sent messages never count as unread for them.
  return notifications.filter((n) => !n.read && n.sender === 'team').length
}

export async function sendMessageFromMember(
  admin: SupabaseClient,
  args: { userId: string; body: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = args.body.trim()
  if (!body) return { ok: false, error: 'Write a message first' }
  const title = body.split('\n')[0].slice(0, 80)
  const { error } = await admin.from('member_notifications').insert({
    user_id: args.userId,
    title,
    body,
    sender: 'member',
    created_by: args.userId,
  })
  if (error) {
    console.error('[notifications] member send failed:', error)
    return { ok: false, error: 'Could not send your message' }
  }
  return { ok: true }
}

export async function markNotificationsRead(
  admin: SupabaseClient,
  userId: string,
  notificationIds: string[]
): Promise<void> {
  if (notificationIds.length === 0) return
  const { error } = await admin.from('member_notification_reads').upsert(
    notificationIds.map((id) => ({
      notification_id: id,
      user_id: userId,
    })),
    { onConflict: 'notification_id,user_id', ignoreDuplicates: true }
  )
  if (error) {
    console.warn('[notifications] mark-read failed:', error)
  }
}
