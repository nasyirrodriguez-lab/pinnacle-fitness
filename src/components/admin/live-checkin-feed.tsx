'use client'

import {
  useEffect,
  useState,
  useRef,
  useSyncExternalStore,
  useTransition,
} from 'react'
import {
  UserCircle,
  UserPlus,
  Compass,
  Volume2,
  VolumeX,
  Clock,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { adminCheckOutVisit } from '@/app/admin/checkin/actions'

// =====================================================================
// Live check-in feed for /admin (mission-control overview). Subscribes
// to Supabase Realtime INSERTs on the `visits` table. New rows slide in
// with a soft tone and visual highlight. Sound can be muted.
// =====================================================================

export interface InitialVisitRow {
  id: string
  kind: 'member' | 'guest' | 'tour'
  user_id: string | null
  guest_name: string | null
  guest_email: string | null
  reason: string | null
  selfie_path: string | null
  checked_in_at: string
  checked_out_at: string | null
  // Hydrated server-side
  display_name: string | null
  profile_email: string | null
  profile_selfie_path: string | null
  signed_selfie_url: string | null
}

interface Props {
  initial: InitialVisitRow[]
  signedInUrlsValidForMinutes: number
}

// Mute state persists across reloads. We expose it via a tiny
// useSyncExternalStore so the component reads localStorage without
// needing a setState-in-effect call on mount.
const MUTE_KEY = 'worx_admin_live_muted'
const muteSubscribers = new Set<() => void>()

function isMutedFromStorage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function subscribeMute(cb: () => void): () => void {
  muteSubscribers.add(cb)
  return () => {
    muteSubscribers.delete(cb)
  }
}

function notifyMute() {
  muteSubscribers.forEach((cb) => cb())
}

function getMuteServerSnapshot(): boolean {
  // Default to muted on the server so the page never auto-plays sound
  // during hydration.
  return true
}

function setMuteValue(next: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  } catch {
    /* ignore */
  }
  notifyMute()
}

function playChime() {
  if (typeof window === 'undefined') return
  // Use the WebAudio API for a tiny soft chime — no asset to load and
  // works even when the page is in the background (subject to browser
  // autoplay policy; a prior user gesture unlocks it).
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioCtor) return
    const ctx = new AudioCtor()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.18)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.5)
    // Let the context close on its own to avoid hitting browser limits.
    window.setTimeout(() => ctx.close().catch(() => {}), 600)
  } catch {
    /* audio unavailable */
  }
}

interface RawVisitRow {
  id: string
  kind: 'member' | 'guest' | 'tour'
  user_id: string | null
  guest_name: string | null
  guest_email: string | null
  reason: string | null
  selfie_path: string | null
  checked_in_at: string
  checked_out_at: string | null
}

export default function LiveCheckinFeed({
  initial,
  signedInUrlsValidForMinutes,
}: Props) {
  const [rows, setRows] = useState<InitialVisitRow[]>(initial)
  const muted = useSyncExternalStore(
    subscribeMute,
    isMutedFromStorage,
    getMuteServerSnapshot
  )
  const [justArrivedId, setJustArrivedId] = useState<string | null>(null)
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null)
  const [, startCheckout] = useTransition()

  const checkOut = (visitId: string) => {
    setCheckingOutId(visitId)
    startCheckout(async () => {
      const result = await adminCheckOutVisit(visitId)
      if (result.ok || result.error === 'Already checked out') {
        setRows((prev) =>
          prev.map((r) =>
            r.id === visitId
              ? { ...r, checked_out_at: new Date().toISOString() }
              : r
          )
        )
      }
      setCheckingOutId(null)
    })
  }
  const mountedAt = useRef<number>(0)

  useEffect(() => {
    mountedAt.current = Date.now()
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    // Realtime needs the user's access token explicitly — the websocket
    // doesn't read the session cookie the way HTTP requests do, so
    // without setAuth() the connection is treated as anonymous and the
    // RLS check on `visits` (is_admin()) returns false, silently
    // suppressing the broadcast.
    const subscribe = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      const token = session?.access_token
      if (token) {
        await supabase.realtime.setAuth(token)
      }

      channel = supabase
        .channel('admin-live-checkins')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'visits' },
          async (payload) => {
            const raw = payload.new as RawVisitRow
            const hydrated = await hydrate(raw)
            setRows((prev) => {
              if (prev.some((r) => r.id === hydrated.id)) return prev
              return [hydrated, ...prev].slice(0, 50)
            })
            setJustArrivedId(hydrated.id)
            window.setTimeout(() => setJustArrivedId(null), 1500)
            if (!isMutedFromStorage()) playChime()
          }
        )
        .subscribe((status, err) => {
          // Surface real subscription errors so we don't silently sit
          // there with a dead channel forever.
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('[live-checkin-feed] subscribe status:', status, err)
          }
        })
    }
    void subscribe()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [])

  // Periodically re-render relative timestamps. The minute hand moves
  // every 30 seconds is enough.
  const [_, forceRerender] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => forceRerender((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])
  void _

  const toggleMute = () => {
    const next = !muted
    setMuteValue(next)
    // Prime the audio context on the first un-mute click so subsequent
    // chimes are allowed by browser autoplay policy.
    if (!next) playChime()
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
            Live · arrivals
          </p>
          <h2 className="font-heading text-lg">Who&apos;s coming up</h2>
        </div>
        <button
          type="button"
          onClick={toggleMute}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 border border-neutral-200"
          aria-label={muted ? 'Unmute check-in sound' : 'Mute check-in sound'}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          {muted ? 'Sound off' : 'Sound on'}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="p-8 text-sm text-neutral-500 text-center">
          No check-ins yet today. New arrivals will appear here in real time.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {rows.map((r) => (
            <li
              key={r.id}
              className={
                r.id === justArrivedId
                  ? 'px-5 py-3 flex items-center gap-3 bg-turquoise-50 animate-slide-in-right transition-colors'
                  : 'px-5 py-3 flex items-center gap-3 transition-colors'
              }
            >
              <Avatar
                url={r.signed_selfie_url}
                kind={r.kind}
                signedInUrlsValidForMinutes={signedInUrlsValidForMinutes}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {r.display_name ?? 'Unknown'}
                </p>
                <p className="text-xs text-neutral-500 truncate">
                  <KindLabel kind={r.kind} />
                  {r.reason ? ` · ${r.reason}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-neutral-500 flex items-center gap-1">
                  <Clock size={10} />
                  {relTime(r.checked_in_at)}
                </p>
                {r.id === justArrivedId && (
                  <p className="text-[10px] uppercase tracking-wide text-turquoise-700 font-medium mt-0.5">
                    Just now
                  </p>
                )}
              </div>
              {r.checked_out_at ? (
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-500">
                  Out
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => checkOut(r.id)}
                  disabled={checkingOutId === r.id}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-neutral-200 rounded-md text-neutral-600 hover:text-neutral-900 hover:border-neutral-400 disabled:opacity-50"
                  title="Check this person out"
                >
                  <LogOut size={11} />
                  {checkingOutId === r.id ? '…' : 'Check out'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Avatar({
  url,
  kind,
  signedInUrlsValidForMinutes,
}: {
  url: string | null
  kind: 'member' | 'guest' | 'tour'
  signedInUrlsValidForMinutes: number
}) {
  void signedInUrlsValidForMinutes
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="w-12 h-12 rounded-full object-cover shrink-0 bg-neutral-100 ring-2 ring-white"
      />
    )
  }
  const Icon =
    kind === 'member' ? UserCircle : kind === 'tour' ? Compass : UserPlus
  return (
    <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center shrink-0 ring-2 ring-white">
      <Icon size={22} className="text-neutral-500" />
    </div>
  )
}

function KindLabel({ kind }: { kind: 'member' | 'guest' | 'tour' }) {
  switch (kind) {
    case 'member':
      return <span className="text-turquoise-700 font-medium">Member</span>
    case 'tour':
      return <span className="text-lime-700 font-medium">Tour</span>
    case 'guest':
    default:
      return <span>Guest</span>
  }
}

function relTime(iso: string): string {
  const then = new Date(iso)
  const diff = Date.now() - then.getTime()
  const s = Math.max(0, Math.floor(diff / 1000))
  if (s < 30) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  const clock = then.toLocaleTimeString('en-US', {
    timeZone: 'America/Port_of_Spain',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${h}h ago, ${clock}`
}

// Hydrate a raw realtime row with display name + selfie URL by calling
// a server endpoint. We use a tiny API route so we can keep the
// signed-URL secret server-side and join the profile in one shot.
async function hydrate(raw: RawVisitRow): Promise<InitialVisitRow> {
  try {
    const res = await fetch('/api/admin/visit-hydrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: raw.id }),
    })
    if (res.ok) {
      const data = (await res.json()) as {
        display_name: string | null
        profile_email: string | null
        profile_selfie_path: string | null
        signed_selfie_url: string | null
      }
      return { ...raw, ...data }
    }
  } catch {
    /* fall through to bare row */
  }
  return {
    ...raw,
    display_name: raw.guest_name ?? raw.guest_email,
    profile_email: null,
    profile_selfie_path: null,
    signed_selfie_url: null,
  }
}
