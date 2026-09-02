import {
  Coffee,
  Clock,
  Users,
  Phone,
  Wrench,
  Moon,
  Smile,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'

// =====================================================================
// Shared definitions for the reception "Be Right Back" status. Used by
// the kiosk controls/banner, the admin card, and the API routes.
// =====================================================================

export interface ReasonDef {
  id: string
  /** Receptionist-facing label in the picker. */
  label: string
  /** Visitor-facing line shown on the status banner. Friendly, first person. */
  message: string
  icon: LucideIcon
}

// Ordered roughly by how often a front desk reaches for each one.
export const REASONS: ReasonDef[] = [
  {
    id: 'lunch',
    label: 'Gone to lunch',
    message: 'Just stepped out for lunch',
    icon: Coffee,
  },
  {
    id: 'break',
    label: 'On a quick break',
    message: 'Taking a quick break',
    icon: Smile,
  },
  {
    id: 'bathroom',
    label: 'Bathroom break',
    message: 'Back in a moment',
    icon: Clock,
  },
  {
    id: 'meeting',
    label: 'In a meeting',
    message: 'In a meeting right now',
    icon: Users,
  },
  {
    id: 'call',
    label: 'On a call',
    message: 'On a call at the moment',
    icon: Phone,
  },
  {
    id: 'errand',
    label: 'Stepped away',
    message: 'Away from the desk for a bit',
    icon: Wrench,
  },
  {
    id: 'eod',
    label: 'Out for the day',
    message: 'The front desk is closed for now',
    icon: Moon,
  },
  {
    id: 'other',
    label: 'Something else',
    message: 'Away from the desk',
    icon: MoreHorizontal,
  },
]

export const DEFAULT_REASON = REASONS[0]

export function getReason(id: string | null | undefined): ReasonDef {
  return REASONS.find((r) => r.id === id) ?? DEFAULT_REASON
}

export interface DurationDef {
  label: string
  minutes: number
}

export const DURATIONS: DurationDef[] = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '1.5 hours', minutes: 90 },
  { label: '2 hours', minutes: 120 },
]

export const DEFAULT_DURATION_MINUTES = 15

// Light-hearted lines shown once the countdown hits zero but the
// receptionist hasn't flipped back to "here" yet. Keeps the board warm.
export const OVERDUE_MESSAGES: string[] = [
  'Running a little late — back any minute now!',
  'Just a few more minutes, thanks for your patience!',
  'Taking slightly longer than planned — almost back!',
  'On my way back — sorry for the wait!',
]

/** Deterministically pick an overdue line from the away-since timestamp. */
export function pickOverdueMessage(awaySinceMs: number): string {
  const index =
    Math.abs(Math.floor(awaySinceMs / 60000)) % OVERDUE_MESSAGES.length
  return OVERDUE_MESSAGES[index]
}

/** Format seconds as mm:ss, or h:mm:ss past an hour. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

/** Seconds remaining until `returnAt` (ISO), clamped at zero. */
export function secondsUntil(
  returnAtIso: string | null,
  nowMs: number
): number {
  if (!returnAtIso) return 0
  const target = new Date(returnAtIso).getTime()
  if (Number.isNaN(target)) return 0
  return Math.max(0, Math.round((target - nowMs) / 1000))
}

/** The shape the kiosk/admin read from Supabase. */
export interface ReceptionStatusRow {
  id: string
  is_away: boolean
  reason_id: string | null
  message: string | null
  away_since: string | null
  return_at: string | null
  set_by_device_id: string | null
  updated_at: string
}

export const RECEPTION_STATUS_ID = '00000000-0000-0000-0000-000000000001'
