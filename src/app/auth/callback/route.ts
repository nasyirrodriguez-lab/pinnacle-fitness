import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'http://localhost:3000'
  )
}

function safeNext(next: string | null): string {
  if (!next) return '/dashboard'
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard'
  return next
}

// Supabase magic-link redirect target. Exchanges the `code` for a session,
// then forwards to `next` (or /dashboard).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  const errorCode = searchParams.get('error_code')
  const supabaseError = searchParams.get('error')

  // Supabase appends ?error=...&error_code=... when the link itself failed
  // (expired, already used, etc) — surface that to the sign-in page.
  if (supabaseError) {
    const tag = errorCode === 'otp_expired' ? 'expired' : 'invalid'
    return NextResponse.redirect(new URL(`/sign-in?error=${tag}`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=missing', request.url))
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    // exchangeCodeForSession fails for three different reasons that look
    // identical from Supabase's API: the code is genuinely expired, the
    // code was already redeemed (single-use), or the request is hitting
    // us from a different browser than the one that requested the link
    // (the PKCE code-verifier cookie is missing). All three are common.
    // We pick the most-likely tag based on whether the cookie is present.
    console.error('[auth/callback] exchange failed:', error)
    const hasVerifier = Array.from(cookieStore.getAll()).some(
      (c) =>
        c.name.includes('code-verifier') ||
        (c.name.startsWith('sb-') && c.name.includes('auth-token-code'))
    )
    const tag = hasVerifier ? 'used-or-expired' : 'wrong-browser'
    return NextResponse.redirect(new URL(`/sign-in?error=${tag}`, request.url))
  }

  return NextResponse.redirect(new URL(next, getSiteUrl()))
}
