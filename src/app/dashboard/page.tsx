import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import {
  ArrowRight,
  Calendar,
  CreditCard,
  Sparkles,
  Ticket,
  Inbox,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { unreadNotificationCount } from '@/lib/notifications/notify'
import { fmtAstDate } from '@/lib/time/ast'

export const dynamic = 'force-dynamic'

interface PassBalance {
  pass_id: string
  pass_name: string
  uses_remaining: number
  expires_at: string
}

async function loadActivePasses(userId: string): Promise<PassBalance[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data, error } = await supabase
    .from('pass_purchases')
    .select('pass_id, uses_remaining, expires_at, passes(name)')
    .eq('user_id', userId)
    .gt('uses_remaining', 0)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })

  if (error || !data) return []
  return data.map((row) => {
    const passes = row.passes as { name?: string } | { name?: string }[] | null
    const name = Array.isArray(passes) ? passes[0]?.name : passes?.name
    return {
      pass_id: row.pass_id as string,
      pass_name: name ?? row.pass_id,
      uses_remaining: row.uses_remaining as number,
      expires_at: row.expires_at as string,
    }
  })
}

function Tile({
  title,
  body,
  href,
  icon,
}: {
  title: string
  body: string
  href: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group block bg-white border border-neutral-200 rounded-lg p-6 hover:border-turquoise-400 hover:shadow-sm transition"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center">
          {icon}
        </div>
        <ArrowRight
          size={16}
          className="text-neutral-400 group-hover:text-turquoise-600 transition"
        />
      </div>
      <h2 className="font-heading text-base mb-1">{title}</h2>
      <p className="text-sm text-neutral-600">{body}</p>
    </Link>
  )
}

function PassBalanceCard({ passes }: { passes: PassBalance[] }) {
  const totalRemaining = passes.reduce((sum, p) => sum + p.uses_remaining, 0)
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
            <Ticket size={20} />
          </div>
          <div>
            <h2 className="font-heading text-base mb-1">Your passes</h2>
            <p className="text-sm text-neutral-600 mb-2">
              {totalRemaining} {totalRemaining === 1 ? 'day' : 'days'} remaining
              across {passes.length} {passes.length === 1 ? 'pass' : 'passes'}.
            </p>
            <ul className="text-xs text-neutral-500 space-y-1">
              {passes.map((p, i) => (
                <li key={i}>
                  {p.pass_name} — {p.uses_remaining} remaining, expires{' '}
                  {fmtAstDate(p.expires_at)}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Link href="/buy/day-pass">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium border border-neutral-200 rounded-md hover:bg-neutral-50 whitespace-nowrap"
          >
            Buy more
          </button>
        </Link>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const [passes, unreadMessages] = await Promise.all([
    loadActivePasses(user.id),
    unreadNotificationCount(createAdminClient(), user.id),
  ])
  const firstName = (user.fullName ?? user.email).split(' ')[0].split('@')[0]

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl mb-1">
          {firstName ? `Hey ${firstName}` : 'Welcome'}
        </h1>
        <p className="text-neutral-600">
          Your member dashboard. Book a spot, manage your plan, see your
          history.
        </p>
      </div>

      {unreadMessages > 0 && (
        <Link
          href="/dashboard/messages"
          className="mb-6 flex items-center gap-3 bg-turquoise-50 border border-turquoise-200 rounded-lg px-5 py-4 hover:border-turquoise-400 transition"
        >
          <Inbox size={20} className="text-turquoise-700 shrink-0" />
          <span className="flex-1 text-sm font-medium text-turquoise-900">
            You have {unreadMessages} new message
            {unreadMessages === 1 ? '' : 's'} from The Worx team.
          </span>
          <span className="text-sm text-turquoise-700 font-medium shrink-0">
            Read →
          </span>
        </Link>
      )}

      {passes.length > 0 && <PassBalanceCard passes={passes} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          title="Book a room"
          body="Meeting room or conference room, by the hour."
          href="/book"
          icon={<Calendar size={20} />}
        />
        <Tile
          title="Buy a day pass"
          body="Day, 5-day, or 10-day pass."
          href="/buy"
          icon={<Ticket size={20} />}
        />
        <Tile
          title="Plans & passes"
          body="Pick a monthly plan or buy a multi-day pass."
          href="/pricing"
          icon={<CreditCard size={20} />}
        />
        <Tile
          title="Refer a friend"
          body="Bring builders into the community."
          href="/dashboard/refer"
          icon={<Sparkles size={20} />}
        />
      </div>
    </div>
  )
}
