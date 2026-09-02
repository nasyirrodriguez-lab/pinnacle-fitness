import type { GymSettings } from '@/lib/gym/settings'

// The booking rules, as pure functions so the member app, the iPad and
// the crons can't disagree about them.

export type CancelOutcome = 'free' | 'uses_session' | 'too_late'

// Free until the cancel window; inside it the session is spent; once
// the slot has started it can't be cancelled at all (no-show handles it).
export function cancelOutcome(
  slotStartIso: string,
  settings: GymSettings,
  now = Date.now()
): CancelOutcome {
  const start = new Date(slotStartIso).getTime()
  if (now >= start) return 'too_late'
  const windowMs = settings.ptCancelHours * 60 * 60 * 1000
  return start - now >= windowMs ? 'free' : 'uses_session'
}

// The iPad accepts a PT check-in from N minutes before the slot to N
// minutes after it starts; outside that a coach confirms by hand.
export function checkinWindow(
  slotStartIso: string,
  settings: GymSettings,
  now = Date.now()
): 'open' | 'early' | 'late' {
  const start = new Date(slotStartIso).getTime()
  const earliest = start - settings.checkinEarlyMinutes * 60 * 1000
  const latest = start + settings.checkinLateMinutes * 60 * 1000
  if (now < earliest) return 'early'
  if (now > latest) return 'late'
  return 'open'
}

// A PT booking with no check-in this long after its start is a no-show.
export function isNoShow(
  slotStartIso: string,
  checkedInAt: string | null,
  settings: GymSettings,
  now = Date.now()
): boolean {
  if (checkedInAt) return false
  const start = new Date(slotStartIso).getTime()
  return now - start > settings.noShowMinutes * 60 * 1000
}

export function fmtHours(hours: number): string {
  return hours === 1 ? '1 hour' : `${hours} hours`
}
