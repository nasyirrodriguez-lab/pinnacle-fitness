import Link from 'next/link'
import { Inbox, ChevronRight } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Virtual Office — Admin',
}

interface Row {
  id: string
  user_id: string
  business_name: string
  is_active: boolean
  created_at: string
  forwarding_email: string | null
  profiles: { full_name: string | null; email: string } | null
}

interface MailCountRow {
  user_id: string
  count: number
}

async function loadSubscriptions(): Promise<Row[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('virtual_office_subscriptions')
    .select(
      'id, user_id, business_name, is_active, created_at, forwarding_email, profiles!virtual_office_subscriptions_user_id_fkey(full_name, email)'
    )
    .order('created_at', { ascending: false })
  if (!data) return []
  return (data as unknown as Row[]).map((r) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : r.profiles,
  }))
}

async function loadUnreadCounts(): Promise<Map<string, number>> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('virtual_office_mail')
    .select('user_id')
    .eq('status', 'received')
  const counts = new Map<string, number>()
  if (!data) return counts
  for (const row of data as unknown as MailCountRow[]) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1)
  }
  return counts
}

async function loadPendingDocCounts(): Promise<Map<string, number>> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('virtual_office_documents')
    .select('user_id')
    .eq('status', 'pending')
  const counts = new Map<string, number>()
  if (!data) return counts
  for (const row of data as unknown as { user_id: string }[]) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1)
  }
  return counts
}

export default async function AdminVOPage() {
  const [subs, counts, pendingDocs] = await Promise.all([
    loadSubscriptions(),
    loadUnreadCounts(),
    loadPendingDocCounts(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl mb-2">
          Virtual Office
        </h1>
        <p className="text-sm text-neutral-600">
          {subs.length} subscription{subs.length === 1 ? '' : 's'} ·{' '}
          {subs.filter((s) => s.is_active).length} active
        </p>
      </div>

      {subs.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
          <Inbox size={28} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-700 mb-1">
            No Virtual Office subscriptions yet
          </p>
        </div>
      ) : (
        <ul className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100">
          {subs.map((s) => {
            const unread = counts.get(s.user_id) ?? 0
            const pending = pendingDocs.get(s.user_id) ?? 0
            return (
              <li key={s.id}>
                <Link
                  href={`/admin/virtual-office/${s.user_id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">
                        {s.business_name}
                      </p>
                      {!s.is_active && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                          Inactive
                        </span>
                      )}
                      {unread > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-turquoise-100 text-turquoise-800">
                          {unread} unread
                        </span>
                      )}
                      {pending > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {pending} doc{pending === 1 ? '' : 's'} to review
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 truncate">
                      {s.profiles?.full_name ?? ''} · {s.profiles?.email}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-neutral-400 shrink-0"
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
