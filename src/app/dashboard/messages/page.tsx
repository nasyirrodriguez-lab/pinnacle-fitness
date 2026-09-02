import { redirect } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  listNotificationsFor,
  markNotificationsRead,
} from '@/lib/notifications/notify'
import { fmtAstDateTime } from '@/lib/time/ast'
import MessageCompose from '@/components/dashboard/message-compose'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Messages — The Worx',
}

export default async function MessagesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const admin = createAdminClient()
  const notifications = await listNotificationsFor(admin, user.id, 100)

  // Opening the page reads everything — same mental model as email.
  // Only team-sent messages need read receipts; your own don't.
  const unreadIds = notifications
    .filter((n) => !n.read && n.sender === 'team')
    .map((n) => n.id)
  await markNotificationsRead(admin, user.id, unreadIds)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Messages</h1>
        <p className="text-neutral-600">
          Updates from The Worx team — and a direct line back to us.
        </p>
      </div>

      <MessageCompose />

      {notifications.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-10 text-center">
          <Inbox size={32} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">
            Nothing yet. Messages from the team will land here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={
                n.sender === 'member'
                  ? 'bg-neutral-50 border border-neutral-200 rounded-lg p-5 ml-6 md:ml-16'
                  : n.read
                    ? 'bg-white border border-neutral-200 rounded-lg p-5'
                    : 'bg-white border-l-4 border border-neutral-200 border-l-turquoise-500 rounded-lg p-5'
              }
            >
              {n.sender === 'team' && (
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h2 className="font-heading text-lg">{n.title}</h2>
                  {!n.read && (
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-turquoise-100 text-turquoise-900">
                      New
                    </span>
                  )}
                </div>
              )}
              <p className="text-sm text-neutral-700 whitespace-pre-line">
                {n.body}
              </p>
              <p className="text-xs text-neutral-500 mt-3">
                {n.sender === 'member' ? 'You' : 'The Worx team'} ·{' '}
                {fmtAstDateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
