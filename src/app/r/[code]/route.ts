import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { setReferralCookie } from '@/lib/referrals/cookie'
import { isValidCodeShape } from '@/lib/referrals/codes'
import { createAdminClient } from '@/utils/supabase/admin'

// /r/<code> — shareable personal referral link. Validates the code,
// sets a 30-day attribution cookie, then sends the visitor to /sign-up.
// If they're already signed in, we send them to the dashboard with a
// banner so they don't accidentally lose their own attribution.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  if (!code || !isValidCodeShape(code)) {
    return NextResponse.redirect(new URL('/', _request.url))
  }

  // Verify the code resolves to a real member before we set the cookie.
  // Bad codes shouldn't pollute the cookie space.
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id')
    .ilike('referral_code', code)
    .maybeSingle()
  if (!data) {
    return NextResponse.redirect(new URL('/sign-up', _request.url))
  }

  // If they're already signed in, don't overwrite anything — just bounce
  // them to the dashboard. (A signed-in visitor can't be referred.)
  const store = await cookies()
  const signedIn = store.get('worx_signed_in')?.value === '1'
  if (signedIn) {
    return NextResponse.redirect(new URL('/dashboard', _request.url))
  }

  await setReferralCookie(code.toUpperCase())
  return NextResponse.redirect(new URL('/sign-up?referred=1', _request.url))
}
