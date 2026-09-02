/**
 * One-shot import of the legacy Nexudus member list into Supabase.
 *
 * Pre-reqs:
 *   - Migrations 0001 + 0002 + 0003 applied to the Supabase project.
 *   - .env.local contains:
 *       NEXT_PUBLIC_SUPABASE_URL
 *       SUPABASE_SERVICE_ROLE_KEY   (Settings → API → service_role)
 *
 * Run:
 *   npx tsx scripts/import-members.ts /Users/markp/Downloads/worx\ contacts\ -\ all\ contacts.csv
 *
 * Behavior:
 *   - Reads the CSV
 *   - Skips rows with no email
 *   - Deduplicates by email, keeping the row with the latest 'Since' date
 *   - For each unique row:
 *       1. Creates an auth.users record (if missing) using admin createUser.
 *          The handle_new_user() trigger auto-creates a profiles row.
 *       2. Upserts the rest of the profile fields by id.
 *   - Idempotent — re-running updates existing rows in place.
 *   - Prints a summary of inserts vs updates vs skips.
 */

import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface CsvRow {
  nexudusId: string
  fullName: string
  team: string
  email: string
  address: string
  city: string
  phone: string
  mobile: string
  since: string // dd/mm/yyyy
  lastAccess: string // dd/mm/yyyy
  pincode: string
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') {
        inQuotes = false
      } else {
        cur += c
      }
    } else {
      if (c === ',') {
        out.push(cur)
        cur = ''
      } else if (c === '"') {
        inQuotes = true
      } else {
        cur += c
      }
    }
  }
  out.push(cur)
  return out
}

function ddmmyyyyToDate(s: string): Date | null {
  if (!s) return null
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd))
}

async function loadCsv(path: string): Promise<CsvRow[]> {
  const text = await readFile(path, 'utf8')
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  // Line 1 is "Member & Contacts List", line 2 is the header.
  const rows = lines.slice(2)
  return rows
    .map((line) => {
      const f = parseCsvLine(line)
      return {
        nexudusId: f[0]?.trim() ?? '',
        fullName: f[1]?.trim() ?? '',
        team: f[2]?.trim() ?? '',
        email: f[3]?.trim().toLowerCase() ?? '',
        address: f[4]?.trim() ?? '',
        city: f[5]?.trim() ?? '',
        phone: f[6]?.trim() ?? '',
        mobile: f[7]?.trim() ?? '',
        since: f[8]?.trim() ?? '',
        lastAccess: f[9]?.trim() ?? '',
        pincode: f[10]?.trim() ?? '',
      }
    })
    .filter((r) => r.email.length > 0)
}

function dedupeByEmailKeepLatestSince(rows: CsvRow[]): CsvRow[] {
  const map = new Map<string, CsvRow>()
  for (const r of rows) {
    const existing = map.get(r.email)
    if (!existing) {
      map.set(r.email, r)
      continue
    }
    const a = ddmmyyyyToDate(existing.since)?.getTime() ?? 0
    const b = ddmmyyyyToDate(r.since)?.getTime() ?? 0
    if (b > a) map.set(r.email, r)
  }
  return Array.from(map.values())
}

function rowToProfileUpdate(r: CsvRow) {
  return {
    email: r.email,
    full_name: r.fullName || null,
    phone: r.mobile || r.phone || null,
    company: r.team || null,
    address: r.address || null,
    city: r.city || null,
    pincode: r.pincode || null,
    nexudus_id: r.nexudusId || null,
    registered_at: ddmmyyyyToDate(r.since)?.toISOString() ?? null,
    last_access_at: ddmmyyyyToDate(r.lastAccess)?.toISOString() ?? null,
  }
}

async function loadAllExistingUsers(): Promise<Map<string, string>> {
  // One pass through every page of existing users. Returns email -> id.
  const map = new Map<string, string>()
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    })
    if (error)
      throw new Error(`listUsers failed on page ${page}: ${error.message}`)
    for (const u of data.users) {
      if (u.email) map.set(u.email.toLowerCase(), u.id)
    }
    if (data.users.length < perPage) break
    page++
  }
  return map
}

async function createAuthUser(
  email: string,
  fullName: string | null
): Promise<{ id: string } | { error: string }> {
  const { data: created, error: createErr } =
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : {},
    })
  if (createErr) return { error: createErr.message }
  if (!created.user) return { error: 'no user returned from createUser' }
  return { id: created.user.id }
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage: npx tsx scripts/import-members.ts <path-to-csv>')
    process.exit(1)
  }

  console.log(`reading ${csvPath}`)
  const allRows = await loadCsv(csvPath)
  console.log(`  ${allRows.length} rows with email`)

  const deduped = dedupeByEmailKeepLatestSince(allRows)
  console.log(`  ${deduped.length} unique emails`)
  console.log(`  ${allRows.length - deduped.length} duplicate rows skipped`)

  console.log('loading existing auth users...')
  const existingByEmail = await loadAllExistingUsers()
  console.log(`  ${existingByEmail.size} existing auth users`)

  let inserted = 0
  let updated = 0
  let failed = 0
  const errors: { email: string; error: string }[] = []

  for (const [i, row] of deduped.entries()) {
    let userId = existingByEmail.get(row.email)
    let created = false

    if (!userId) {
      const result = await createAuthUser(row.email, row.fullName || null)
      if ('error' in result) {
        failed++
        errors.push({ email: row.email, error: result.error })
        continue
      }
      userId = result.id
      created = true
    }

    const update = rowToProfileUpdate(row)
    const { error: updateErr } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', userId)

    if (updateErr) {
      failed++
      errors.push({ email: row.email, error: updateErr.message })
      continue
    }

    if (created) inserted++
    else updated++

    if ((i + 1) % 25 === 0 || i === deduped.length - 1) {
      console.log(
        `  ${i + 1}/${deduped.length}: ${inserted} inserted, ${updated} updated, ${failed} failed`
      )
    }
  }

  console.log('\n=== summary ===')
  console.log(`inserted: ${inserted}`)
  console.log(`updated:  ${updated}`)
  console.log(`failed:   ${failed}`)

  if (errors.length > 0) {
    console.log('\nfirst 10 errors:')
    for (const e of errors.slice(0, 10)) {
      console.log(`  ${e.email}: ${e.error}`)
    }
  }
}

main().catch((err) => {
  console.error('fatal:', err)
  process.exit(1)
})
