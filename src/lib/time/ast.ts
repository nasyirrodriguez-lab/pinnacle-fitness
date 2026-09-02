// =====================================================================
// AST — Atlantic Standard Time (UTC-4, no DST). Pinnacle Fitness operates in
// Trinidad, so every date/time the app displays should be rendered in
// AST regardless of where the server (Vercel = UTC) or the viewer's
// browser happens to be. Storage stays UTC; this module is the display
// + day-boundary layer only.
//
// Why an explicit helper instead of process.env.TZ:
//   - process.env.TZ only affects the server. Client components run in
//     the user's browser TZ — a digital nomad in London would still see
//     London time without explicit timeZone hints.
//   - Centralizing here means future "what TZ are we?" changes are one
//     edit, not 30.
// =====================================================================

export const WORX_TIMEZONE = 'America/Port_of_Spain'
export const WORX_LOCALE = 'en-US'

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: WORX_TIMEZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}

const DATE_TIME_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: WORX_TIMEZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
}

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: WORX_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
}

const WEEKDAY_DATE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: WORX_TIMEZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
}

// Memoize formatters — Intl.DateTimeFormat is expensive to construct.
const fmtCache = new Map<string, Intl.DateTimeFormat>()
function fmt(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(opts)
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(WORX_LOCALE, opts)
    fmtCache.set(key, f)
  }
  return f
}

function toDate(input: Date | string | number): Date {
  return input instanceof Date ? input : new Date(input)
}

// Renders "May 27, 2026"
export function fmtAstDate(
  input: Date | string | number | null | undefined
): string {
  if (input === null || input === undefined) return '—'
  const d = toDate(input)
  if (Number.isNaN(d.getTime())) return '—'
  return fmt(DATE_OPTS).format(d)
}

// Renders "May 27, 2026, 2:14 PM"
export function fmtAstDateTime(
  input: Date | string | number | null | undefined
): string {
  if (input === null || input === undefined) return '—'
  const d = toDate(input)
  if (Number.isNaN(d.getTime())) return '—'
  return fmt(DATE_TIME_OPTS).format(d)
}

// Renders "2:14 PM"
export function fmtAstTime(
  input: Date | string | number | null | undefined
): string {
  if (input === null || input === undefined) return '—'
  const d = toDate(input)
  if (Number.isNaN(d.getTime())) return '—'
  return fmt(TIME_OPTS).format(d)
}

// Renders "Wed, May 27"
export function fmtAstWeekdayDate(
  input: Date | string | number | null | undefined
): string {
  if (input === null || input === undefined) return '—'
  const d = toDate(input)
  if (Number.isNaN(d.getTime())) return '—'
  return fmt(WEEKDAY_DATE_OPTS).format(d)
}

// =====================================================================
// Day-boundary math
//
// "Is this booking today?" or "lapsed 30+ days" comparisons need AST
// day boundaries, otherwise a member who books for AST-Wednesday-11pm
// could see the booking move to Thursday because the UTC server crossed
// midnight at AST 8pm.
// =====================================================================

const PARTS_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: WORX_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
}

interface AstParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function astParts(d: Date): AstParts {
  // Intl gives us the wall-clock components in AST without DST surprises.
  const parts = fmt(PARTS_OPTS).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24, // Intl returns 24 for midnight in en-US hour12=false
    minute: get('minute'),
    second: get('second'),
  }
}

// Returns the YYYY-MM-DD of `input` in AST — useful for grouping events
// by date or comparing two timestamps for "same day in Trinidad".
export function astDateKey(input: Date | string | number): string {
  const p = astParts(toDate(input))
  const mm = String(p.month).padStart(2, '0')
  const dd = String(p.day).padStart(2, '0')
  return `${p.year}-${mm}-${dd}`
}

// Returns the AST midnight of `input` as a Date (UTC instant). Use when
// you need to query "everything from start of AST today onward."
export function astStartOfDay(
  input: Date | string | number = new Date()
): Date {
  const p = astParts(toDate(input))
  const mm = String(p.month).padStart(2, '0')
  const dd = String(p.day).padStart(2, '0')
  return new Date(`${p.year}-${mm}-${dd}T00:00:00-04:00`)
}

// Returns the AST 23:59:59.999 of `input` as a Date.
export function astEndOfDay(input: Date | string | number = new Date()): Date {
  const p = astParts(toDate(input))
  const mm = String(p.month).padStart(2, '0')
  const dd = String(p.day).padStart(2, '0')
  return new Date(`${p.year}-${mm}-${dd}T23:59:59.999-04:00`)
}

// Returns true if two timestamps fall on the same calendar day in AST.
export function astIsSameDay(
  a: Date | string | number,
  b: Date | string | number
): boolean {
  return astDateKey(a) === astDateKey(b)
}

// Days between two AST dates (a - b), positive when a is after b. Works
// on AST day boundaries so DST/timezone drift can't add or subtract a
// phantom day.
export function astDaysBetween(
  a: Date | string | number,
  b: Date | string | number
): number {
  const sa = astStartOfDay(a).getTime()
  const sb = astStartOfDay(b).getTime()
  return Math.round((sa - sb) / (24 * 60 * 60 * 1000))
}

// Returns the AST date key of "today" — i.e. now() projected to AST.
export function astTodayKey(): string {
  return astDateKey(new Date())
}
