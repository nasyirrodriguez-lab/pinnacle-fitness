// Booking slot math + availability.
// Resources have configured open/close hours and slot_minutes granularity.
// We generate one cell per slot and mark each available / busy / mine.

export interface SlotCell {
  startIso: string
  endIso: string
  available: boolean
  bookedByMe: boolean
}

export interface ResourceForBooking {
  id: string
  name: string
  description: string | null
  kind: string
  capacity: number
  price_per_hour_cents: number | null
  after_hours_price_per_hour_cents?: number | null
  after_hours_starts_at_hour?: number | null
  currency: string
  open_hour: number
  close_hour: number
  slot_minutes: number
}

interface BookingRange {
  during_lower: string
  during_upper: string
  user_id: string | null
}

// AST is UTC-4 with no DST. Build the slot start/end as an explicit ISO
// string with the AST offset so a resource opening at "8am" always means
// 8am Trinidad time — independent of where the server (Vercel = UTC) or
// the client browser (anywhere) actually runs.
function atTimeOfDay(date: Date, hour: number, minute = 0): Date {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return new Date(`${year}-${month}-${day}T${hh}:${mm}:00-04:00`)
}

// Day grid for one resource. `busy` are existing held/confirmed bookings
// returned as { during_lower, during_upper } strings.
export function buildDayGrid(args: {
  resource: ResourceForBooking
  date: Date
  busy: BookingRange[]
  currentUserId: string | null
}): SlotCell[] {
  const cells: SlotCell[] = []
  const slotMs = args.resource.slot_minutes * 60 * 1000
  const open = atTimeOfDay(args.date, args.resource.open_hour).getTime()
  const close = atTimeOfDay(args.date, args.resource.close_hour).getTime()
  const now = Date.now()

  // Pre-index busy ranges as ms-pair tuples for quick overlap checks
  const busyMs = args.busy.map((b) => ({
    start: new Date(b.during_lower).getTime(),
    end: new Date(b.during_upper).getTime(),
    mine: b.user_id != null && b.user_id === args.currentUserId,
  }))

  for (let t = open; t + slotMs <= close; t += slotMs) {
    const startMs = t
    const endMs = t + slotMs
    const isPast = endMs <= now
    const overlap = busyMs.find((b) => b.start < endMs && b.end > startMs)
    cells.push({
      startIso: new Date(startMs).toISOString(),
      endIso: new Date(endMs).toISOString(),
      available: !isPast && !overlap,
      bookedByMe: Boolean(overlap?.mine),
    })
  }

  return cells
}

// Encode a selected range so it survives form submission.
// Each entry is `<startIso>__<endIso>`.
export function encodeSlotSelection(
  slots: { startIso: string; endIso: string }[]
): string {
  return slots.map((s) => `${s.startIso}__${s.endIso}`).join('|')
}

export function decodeSlotSelection(
  raw: string
): { startIso: string; endIso: string }[] {
  if (!raw) return []
  return raw
    .split('|')
    .map((pair) => {
      const idx = pair.indexOf('__')
      if (idx === -1) return null
      return {
        startIso: pair.slice(0, idx),
        endIso: pair.slice(idx + 2),
      }
    })
    .filter((p): p is { startIso: string; endIso: string } => p !== null)
}

// Returns the AST hour-of-day of an ISO timestamp without instantiating
// an Intl formatter for every slot (perf — this gets called per row).
function astHourOfDay(iso: string): number {
  // Construct a Date and read its UTC hour, then subtract AST's UTC-4
  // offset. AST has no DST so this is always 4 hours behind UTC.
  const d = new Date(iso)
  const utcHour = d.getUTCHours()
  const utcMin = d.getUTCMinutes()
  // -4 in minutes, normalize to [0, 24)
  const astMinutes = (utcHour * 60 + utcMin - 4 * 60 + 24 * 60) % (24 * 60)
  return Math.floor(astMinutes / 60)
}

// Returns the cents-per-hour rate applicable to a slot starting at
// `startIso`. When the resource has an after-hours tier configured and
// the slot starts at or after that hour (AST), the after-hours rate
// applies. Otherwise the regular rate.
export function rateForSlotCents(
  resource: {
    price_per_hour_cents: number | null
    after_hours_price_per_hour_cents?: number | null
    after_hours_starts_at_hour?: number | null
  },
  startIso: string
): number {
  const regular = resource.price_per_hour_cents ?? 0
  const ahRate = resource.after_hours_price_per_hour_cents ?? null
  const ahStart = resource.after_hours_starts_at_hour ?? null
  if (ahRate === null || ahStart === null) return regular
  return astHourOfDay(startIso) >= ahStart ? ahRate : regular
}

export function priceSlotsCents(
  resource: {
    price_per_hour_cents: number | null
    after_hours_price_per_hour_cents?: number | null
    after_hours_starts_at_hour?: number | null
  },
  slots: { startIso: string; endIso: string }[]
): number {
  let total = 0
  for (const s of slots) {
    const rate = rateForSlotCents(resource, s.startIso)
    if (!rate) continue
    const hours =
      (new Date(s.endIso).getTime() - new Date(s.startIso).getTime()) /
      (60 * 60 * 1000)
    total += hours * rate
  }
  return Math.round(total)
}

// Postgres tstzrange string parser. Format: '["2026-05-14 14:00:00+00","2026-05-14 15:00:00+00")'
export function parseTstzRange(
  raw: string
): { during_lower: string; during_upper: string } | null {
  const m = raw.match(/^[\[(]"?([^",)]+)"?,"?([^",)]+)"?[\])]$/)
  if (!m) return null
  return { during_lower: m[1], during_upper: m[2] }
}
