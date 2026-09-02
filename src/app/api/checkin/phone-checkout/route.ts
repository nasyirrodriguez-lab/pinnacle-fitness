import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Self-serve check-out from the member's own phone: closes their most
// recent open visit. Session-gated — you can only check yourself out.
export async function POST() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: openVisit } = await admin
    .from('visits')
    .select('id')
    .eq('user_id', user.id)
    .is('checked_out_at', null)
    .order('checked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!openVisit) {
    return NextResponse.json({ error: 'not_checked_in' }, { status: 404 })
  }

  const { error } = await admin
    .from('visits')
    .update({ checked_out_at: new Date().toISOString() })
    .eq('id', (openVisit as { id: string }).id)
    .is('checked_out_at', null)

  if (error) {
    console.error('[checkin/phone-checkout] update failed:', error)
    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 })
  }

  return NextResponse.json({ status: 'checked_out' })
}
