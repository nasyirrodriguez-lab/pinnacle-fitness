// Helpers for generating + parsing referral codes.
//
// A code looks like "MARK-A8F2": the prefix is derived from the member's
// name (or email local part if no name), the suffix is 4 random
// upper-alphanum chars. Stable per member once issued.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/1/0 to avoid ambiguity

function randomSuffix(length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return out
}

export function deriveCodePrefix(args: {
  fullName?: string | null
  email?: string | null
}): string {
  const source = (args.fullName?.trim() || args.email?.split('@')[0] || 'WORX')
    .toUpperCase()
    // Strip non-alphanum so the result is URL-clean
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 5)
  return source || 'WORX'
}

export function generateReferralCode(args: {
  fullName?: string | null
  email?: string | null
}): string {
  return `${deriveCodePrefix(args)}-${randomSuffix(4)}`
}

// Loose match — we accept any non-empty alphanum-and-dash string, then
// lookup against profiles.referral_code. Case-insensitive lookup happens
// at the DB layer.
export function isValidCodeShape(raw: string): boolean {
  return /^[A-Z0-9-]{4,32}$/i.test(raw)
}
