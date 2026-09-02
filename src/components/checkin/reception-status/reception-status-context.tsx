'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  secondsUntil,
  RECEPTION_STATUS_ID,
  type ReceptionStatusRow,
} from '@/lib/checkin/reception-status'

// =====================================================================
// Holds the live reception "Be Right Back" status for the kiosk. Hydrates
// from a server-provided initial row, then keeps it current via Supabase
// Realtime (public read on reception_status) and a 1s clock for the
// countdown. Both the banner and the options controls read from here.
// =====================================================================

interface ReceptionStatusApi {
  status: ReceptionStatusRow | null
  isAway: boolean
  /** Seconds until return_at, clamped at 0. Recomputed every second. */
  secondsLeft: number
  /** True once the countdown passed return_at but we're still away. */
  isOverdue: boolean
}

const Ctx = createContext<ReceptionStatusApi | null>(null)

export function ReceptionStatusProvider({
  initial,
  children,
}: {
  initial: ReceptionStatusRow | null
  children: React.ReactNode
}) {
  const [status, setStatus] = useState<ReceptionStatusRow | null>(initial)
  // Seeded lazily on the client so the first render's countdown is sane; the
  // interval below keeps it ticking. (Lazy init avoids setState-in-effect.)
  const [nowMs, setNowMs] = useState<number>(() =>
    typeof window === 'undefined' ? 0 : Date.now()
  )

  // Live updates. reception_status has a public-read RLS policy, so the
  // anonymous kiosk websocket receives broadcasts without setAuth().
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('kiosk-reception-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reception_status',
          filter: `id=eq.${RECEPTION_STATUS_ID}`,
        },
        (payload) => {
          const next = payload.new as ReceptionStatusRow
          setStatus(next)
        }
      )
      .subscribe((s, err) => {
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          console.error('[reception-status] subscribe status:', s, err)
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  // 1s clock — only runs while away so we don't churn at the desk. The
  // interval callback (not the effect body) updates state, which keeps the
  // countdown live without a synchronous setState-in-effect.
  useEffect(() => {
    if (!status?.is_away) return
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [status?.is_away, status?.return_at])

  const value = useMemo<ReceptionStatusApi>(() => {
    const isAway = status?.is_away === true
    const secondsLeft = isAway
      ? secondsUntil(status?.return_at ?? null, nowMs)
      : 0
    return {
      status,
      isAway,
      secondsLeft,
      isOverdue: isAway && secondsLeft === 0,
    }
  }, [status, nowMs])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useReceptionStatus(): ReceptionStatusApi {
  const v = useContext(Ctx)
  if (!v) {
    throw new Error(
      'useReceptionStatus must be used within ReceptionStatusProvider'
    )
  }
  return v
}

// Small client mutation helpers so components don't repeat fetch wiring.
export function useReceptionStatusActions() {
  const setAway = useCallback(
    async (reasonId: string, durationMinutes: number) => {
      const res = await fetch('/api/checkin/reception-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonId, durationMinutes }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? 'request_failed')
      }
    },
    []
  )

  const setBack = useCallback(async () => {
    const res = await fetch('/api/checkin/reception-status', {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string
      } | null
      throw new Error(data?.error ?? 'request_failed')
    }
  }, [])

  return { setAway, setBack }
}
