// A coach's day as bookable hours. Availability is a weekly template
// in minutes-since-midnight (5:30 AM = 330) plus one-off blocks; the
// grid is small-group so a slot stays open until `capacity` people
// hold it.

export interface AvailabilityWindow {
  weekday: number // 0 = Sunday … 6 = Saturday
  startMinute: number
  endMinute: number
}

export interface CoachBlock {
  startsAt: string
  endsAt: string
  reason: string | null
}

export interface ExistingBooking {
  startIso: string
  endIso: string
  userId: string | null
}

export interface CoachSlot {
  startIso: string
  endIso: string
  booked: number
  capacity: number
  available: boolean
  isFull: boolean
  isPast: boolean
  bookedByMe: boolean
}

// AST has no DST, so building the ISO string with the -04:00 offset
// makes "5:30 AM" always mean Port of Spain time.
function atMinute(dateKey: string, minute: number): Date {
  const hh = String(Math.floor(minute / 60)).padStart(2, '0')
  const mm = String(minute % 60).padStart(2, '0')
  return new Date(`${dateKey}T${hh}:${mm}:00-04:00`)
}

function astWeekday(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00-04:00`).getUTCDay()
}

export function buildCoachDayGrid(args: {
  dateKey: string // YYYY-MM-DD in AST
  availability: AvailabilityWindow[]
  blocks: CoachBlock[]
  bookings: ExistingBooking[]
  capacity: number
  slotMinutes?: number
  currentUserId: string | null
  now?: number
}): CoachSlot[] {
  const slotMinutes = args.slotMinutes ?? 60
  const weekday = astWeekday(args.dateKey)
  const windows = args.availability.filter((w) => w.weekday === weekday)
  const now = args.now ?? Date.now()
  const slotMs = slotMinutes * 60 * 1000

  const blocks = args.blocks.map((b) => ({
    start: new Date(b.startsAt).getTime(),
    end: new Date(b.endsAt).getTime(),
  }))
  const bookings = args.bookings.map((b) => ({
    start: new Date(b.startIso).getTime(),
    end: new Date(b.endIso).getTime(),
    mine: b.userId != null && b.userId === args.currentUserId,
  }))

  const slots: CoachSlot[] = []
  for (const w of windows) {
    const open = atMinute(args.dateKey, w.startMinute).getTime()
    const close = atMinute(args.dateKey, w.endMinute).getTime()
    for (let t = open; t + slotMs <= close; t += slotMs) {
      const end = t + slotMs
      const blocked = blocks.some((b) => b.start < end && b.end > t)
      if (blocked) continue
      const overlapping = bookings.filter((b) => b.start < end && b.end > t)
      const booked = overlapping.length
      const isPast = end <= now
      const isFull = booked >= args.capacity
      slots.push({
        startIso: new Date(t).toISOString(),
        endIso: new Date(end).toISOString(),
        booked,
        capacity: args.capacity,
        available: !isPast && !isFull,
        isFull,
        isPast,
        bookedByMe: overlapping.some((b) => b.mine),
      })
    }
  }
  return slots.sort((a, b) => a.startIso.localeCompare(b.startIso))
}

// Launch template: both coaches available the whole opening window.
export const DEFAULT_AVAILABILITY: AvailabilityWindow[] = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startMinute: 5 * 60 + 30,
    endMinute: 19 * 60,
  })),
  { weekday: 6, startMinute: 7 * 60, endMinute: 13 * 60 },
]

export function fmtMinute(minute: number): string {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`
}
