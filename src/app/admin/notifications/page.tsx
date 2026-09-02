import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { markNotificationsRead } from '@/lib/notifications/notify'
import { fmtAstDateTime } from '@/lib/time/ast'
import AdminNotificationComposer from '@/components/admin/admin-notification-composer'
import AdminMemberRequests, {
  type MemberRequestRow,
} from '@/components/admin/admin-member-requests'
import MessageGroupsManager, {
  type MessageGroupWithMembers,
} from '@/components/admin/message-groups-manager'

export const dynamic = 'force-dynamic'
// Broadcast messages email every member at ~4/sec — give the actions
// invoked from this page room to finish.
export const maxDuration = 300

export const metadata = {
  title: 'Messages — Admin',
}

interface SentRow {
  id: string
  title: string
  body: string
  createdAt: string
  recipientName: string | null
  readCount: number
}

interface InboxRow {
  id: string
  body: string
  createdAt: string
  fromName: string
  fromEmail: string
  isNew: boolean
}

async function loadInbox(adminId: string): Promise<InboxRow[]> {
  const admin = createAdminClient()
  const [{ data: rows }, { data: readRows }] = await Promise.all([
    admin
      .from('member_notifications')
      .select(
        'id, body, created_at, user_id, profiles!member_notifications_user_id_fkey(full_name, email)'
      )
      .eq('sender', 'member')
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('member_notification_reads')
      .select('notification_id')
      .eq('user_id', adminId),
  ])
  const readIds = new Set(
    ((readRows as { notification_id: string }[] | null) ?? []).map(
      (r) => r.notification_id
    )
  )
  return ((rows as Record<string, unknown>[] | null) ?? []).map((r) => {
    const profRaw = r.profiles as
      | { full_name?: string | null; email?: string }
      | { full_name?: string | null; email?: string }[]
      | null
    const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
    return {
      id: r.id as string,
      body: r.body as string,
      createdAt: r.created_at as string,
      fromName: profile?.full_name?.trim() || profile?.email || 'Member',
      fromEmail: profile?.email ?? '',
      isNew: !readIds.has(r.id as string),
    }
  })
}

async function loadOpenRequests(): Promise<MemberRequestRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('member_requests')
    .select(
      'id, kind, note, created_at, user_id, profiles!member_requests_user_id_fkey(full_name, email)'
    )
    .eq('status', 'open')
    .order('created_at', { ascending: true })
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
    const profRaw = r.profiles as
      | { full_name?: string | null; email?: string }
      | { full_name?: string | null; email?: string }[]
      | null
    const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
    return {
      id: r.id as string,
      kind: r.kind as string,
      note: (r.note as string | null) ?? null,
      createdAt: r.created_at as string,
      memberName: profile?.full_name?.trim() || profile?.email || 'Member',
      memberId: r.user_id as string,
    }
  })
}

async function loadGroups(): Promise<MessageGroupWithMembers[]> {
  const admin = createAdminClient()
  const [{ data: groups }, { data: memberships }] = await Promise.all([
    admin
      .from('message_groups')
      .select('id, name')
      .order('name', { ascending: true }),
    admin
      .from('message_group_members')
      .select(
        'group_id, profiles!message_group_members_user_id_fkey(id, full_name, email)'
      ),
  ])
  const byGroup = new Map<string, MessageGroupWithMembers['members']>()
  for (const raw of (memberships as Record<string, unknown>[] | null) ?? []) {
    const profRaw = raw.profiles as
      | { id?: string; full_name?: string | null; email?: string }
      | { id?: string; full_name?: string | null; email?: string }[]
      | null
    const p = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
    if (!p?.id || !p.email) continue
    const gid = raw.group_id as string
    const list = byGroup.get(gid) ?? []
    list.push({
      id: p.id,
      name: p.full_name?.trim() || p.email,
      email: p.email,
    })
    byGroup.set(gid, list)
  }
  return ((groups as { id: string; name: string }[] | null) ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    members: byGroup.get(g.id) ?? [],
  }))
}

async function loadSent(): Promise<SentRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('member_notifications')
    .select(
      'id, title, body, created_at, user_id, profiles!member_notifications_user_id_fkey(full_name, email)'
    )
    .eq('sender', 'team')
    .order('created_at', { ascending: false })
    .limit(50)
  if (!data) return []

  const rows = data as Record<string, unknown>[]
  const ids = rows.map((r) => r.id as string)
  const readCounts = new Map<string, number>()
  if (ids.length > 0) {
    const { data: reads } = await admin
      .from('member_notification_reads')
      .select('notification_id')
      .in('notification_id', ids)
    for (const r of (reads as { notification_id: string }[] | null) ?? []) {
      readCounts.set(
        r.notification_id,
        (readCounts.get(r.notification_id) ?? 0) + 1
      )
    }
  }

  return rows.map((r) => {
    const profRaw = r.profiles as
      | { full_name?: string | null; email?: string }
      | { full_name?: string | null; email?: string }[]
      | null
    const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
    return {
      id: r.id as string,
      title: r.title as string,
      body: r.body as string,
      createdAt: r.created_at as string,
      recipientName: r.user_id
        ? profile?.full_name?.trim() || profile?.email || 'Member'
        : null,
      readCount: readCounts.get(r.id as string) ?? 0,
    }
  })
}

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>
}) {
  const [{ to }, viewer] = await Promise.all([searchParams, getCurrentUser()])
  const [sent, groups, openRequests] = await Promise.all([
    loadSent(),
    loadGroups(),
    loadOpenRequests(),
  ])
  const inbox = viewer ? await loadInbox(viewer.id) : []

  // Viewing the page clears the "new" markers for this admin.
  if (viewer) {
    await markNotificationsRead(
      createAdminClient(),
      viewer.id,
      inbox.filter((m) => m.isNew).map((m) => m.id)
    )
  }
  const newCount = inbox.filter((m) => m.isNew).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Messages</h1>
        <p className="text-neutral-600 max-w-xl">
          Send in-app messages to one member or the whole community, and read
          what members send back. Everything lives in the dashboard — no email
          deliverability to worry about.
        </p>
        <p className="text-xs text-neutral-500 mt-2">
          Looking for the old email broadcast?{' '}
          <Link href="/admin/email" className="text-darkBlue-900 underline">
            It&apos;s still here.
          </Link>
        </p>
      </div>

      <AdminMemberRequests requests={openRequests} />

      <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
          <MessageCircle size={18} className="text-turquoise-700" />
          <h2 className="font-heading text-lg flex-1">From members</h2>
          {newCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full bg-turquoise-500 text-white">
              {newCount} new
            </span>
          )}
        </div>
        {inbox.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">
            No member messages yet. When someone writes in from their dashboard,
            it lands here.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 max-h-96 overflow-y-auto">
            {inbox.map((m) => (
              <li key={m.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{m.fromName}</span>
                      {m.isNew && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-turquoise-100 text-turquoise-900">
                          NEW
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-neutral-700 whitespace-pre-line mt-1">
                      {m.body}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1.5">
                      {fmtAstDateTime(m.createdAt)}
                    </p>
                  </div>
                  {m.fromEmail && (
                    <Link
                      href={`/admin/notifications?to=${encodeURIComponent(m.fromEmail)}`}
                      className="shrink-0 text-xs font-medium text-darkBlue-900 hover:underline"
                    >
                      Reply
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="font-heading text-lg mb-4">
            {to ? `Reply to ${to}` : 'New message'}
          </h2>
          <AdminNotificationComposer
            key={to ?? 'new'}
            defaultRecipient={to}
            groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          />
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="font-heading text-lg">Sent</h2>
          </div>
          {sent.length === 0 ? (
            <p className="p-6 text-sm text-neutral-500">
              Nothing sent yet. Your first message will show up here.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100 max-h-[36rem] overflow-y-auto">
              {sent.map((n) => (
                <li key={n.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{n.title}</p>
                      <p className="text-sm text-neutral-600 line-clamp-2 mt-0.5">
                        {n.body}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1.5">
                        {fmtAstDateTime(n.createdAt)} ·{' '}
                        {n.recipientName ? (
                          <>to {n.recipientName}</>
                        ) : (
                          'to all members'
                        )}{' '}
                        · read by {n.readCount}
                      </p>
                    </div>
                    <span
                      className={
                        n.recipientName
                          ? 'shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-neutral-100 text-neutral-700'
                          : 'shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-turquoise-100 text-turquoise-900'
                      }
                    >
                      {n.recipientName ? 'Direct' : 'Broadcast'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6">
        <MessageGroupsManager groups={groups} />
      </div>
    </div>
  )
}
