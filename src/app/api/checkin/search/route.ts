import { NextRequest, NextResponse } from 'next/server'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(request: NextRequest) {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const admin = createAdminClient()
  const escaped = q.replace(/[%_,]/g, (c) => `\\${c}`)
  const pattern = `%${escaped}%`

  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
    .eq('role', 'member')
    .order('full_name', { ascending: true })
    .limit(8)
  if (error) {
    return NextResponse.json({ error: 'search_failed' }, { status: 500 })
  }

  return NextResponse.json({
    results: (data ?? []).map((r) => {
      const row = r as { id: string; full_name: string | null; email: string }
      return {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
      }
    }),
  })
}
