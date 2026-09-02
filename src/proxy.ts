import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

const PROTECTED_PREFIXES = ['/dashboard', '/welcome', '/admin']
const SIGNED_IN_HINT_COOKIE = 'worx_signed_in'

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`)
  )
  // Anonymous visitors on public pages have no session to refresh, so
  // skip the Supabase auth round-trip entirely — that network call is
  // the slowest thing in the middleware, and running it on every
  // marketing hit is what let a slow auth response time out the whole
  // request. The rules below only matter for signed-in users or
  // protected paths, and both of those carry a session cookie.
  const hasSessionCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-'))
  const isRedirectPath = path === '/' || path === '/sign-in'
  if (!isProtected && !isRedirectPath && !hasSessionCookie) {
    return NextResponse.next()
  }

  const { response, user } = await updateSession(request)

  // Mirror Supabase auth state into a non-HttpOnly hint cookie so the
  // (client-rendered) header can swap its CTAs without an extra fetch.
  // Forging this only changes UI; real access is gated by the encrypted
  // Supabase session cookie below.
  const hasHint = Boolean(request.cookies.get(SIGNED_IN_HINT_COOKIE))
  if (user && !hasHint) {
    response.cookies.set(SIGNED_IN_HINT_COOKIE, '1', {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  } else if (!user && hasHint) {
    response.cookies.delete(SIGNED_IN_HINT_COOKIE)
  }

  if (isProtected && !user) {
    const url = new URL('/sign-in', request.url)
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  // Signed-in members shouldn't see the marketing home or the sign-in
  // page — send them straight to the dashboard (which will further
  // redirect to /welcome if they still need to accept terms). Other
  // marketing pages (/spaces, /contact, etc.) stay open so members can
  // still browse them and share links.
  if (user && (path === '/' || path === '/sign-in')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Run on everything except static files and api/_next.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
}
