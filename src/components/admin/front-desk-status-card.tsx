'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  getReason,
  formatCountdown,
  secondsUntil,
  pickOverdueMessage,
  RECEPTION_STATUS_ID,
  type ReceptionStatusRow,
} from '@/lib/checkin/reception-status'

// =====================================================================
// Front-desk presence card for /admin. Shows whether reception is at the
// desk or away (with reason + live countdown), subscribing to the same
// reception_status realtime stream the kiosk uses. Admins need their access
// token on the websocket for RLS, same as the live check-in feed.
// =====================================================================

function formatReturnClock(returnAtIso: string | null): string {
  if (!returnAtIso) return ''
  const d = new Date(returnAtIso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', {
    timeZone: 'America/Port_of_Spain',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function FrontDeskStatusCard({
  initial,
}: {
  initial: ReceptionStatusRow | null
}) {
  const [status, setStatus] = useState<ReceptionStatusRow | null>(initial)
  // Lazy client seed; the interval below keeps it ticking while away.
  const [nowMs, setNowMs] = useState<number>(() =>
    typeof window === 'undefined' ? 0 : Date.now()
  )

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    const subscribe = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      const token = session?.access_token
      if (token) await supabase.realtime.setAuth(token)

      channel = supabase
        .channel('admin-reception-status')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reception_status',
            filter: `id=eq.${RECEPTION_STATUS_ID}`,
          },
          (payload) => setStatus(payload.new as ReceptionStatusRow)
        )
        .subscribe()
    }
    void subscribe()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [])

  // Tick the countdown while away. The interval callback updates state, so
  // there's no synchronous setState in the effect body.
  useEffect(() => {
    if (!status?.is_away) return
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [status?.is_away, status?.return_at])

  const isAway = status?.is_away === true

  if (!isAway || !status) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-5">
        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
          Front desk
        </p>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
          <p className="font-heading text-lg">At the desk</p>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Reception is attended right now.
        </p>
      </div>
    )
  }

  const reason = getReason(status.reason_id)
  const Icon = reason.icon
  const secondsLeft = secondsUntil(status.return_at, nowMs)
  const isOverdue = secondsLeft === 0
  const headline = isOverdue
    ? pickOverdueMessage(
        status.away_since ? new Date(status.away_since).getTime() : 0
      )
    : (status.message ?? reason.message)

  return (
    <div className="bg-darkOrange-50 border border-darkOrange-200 rounded-lg p-5">
      <p className="text-xs uppercase tracking-wide text-darkOrange-700 mb-2">
        Front desk · away
      </p>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-md bg-darkOrange-100 text-darkOrange-700 flex items-center justify-center shrink-0">
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-base leading-tight text-neutral-900">
            {headline}
          </p>
          <p className="text-xs text-neutral-600 mt-1">
            {isOverdue ? (
              'Overdue · back any minute'
            ) : (
              <>
                Back in{' '}
                <span className="font-semibold tabular-nums text-neutral-900">
                  {formatCountdown(secondsLeft)}
                </span>
                {status.return_at
                  ? ` · around ${formatReturnClock(status.return_at)}`
                  : ''}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
