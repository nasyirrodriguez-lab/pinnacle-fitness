import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // Refresh the session if expired. This is a network call to Supabase
  // auth, and the middleware is killed by the platform at ~15s — a slow
  // auth response would take the whole site down with a 504 rather than
  // just failing to identify the visitor. Cap it well under that limit
  // and treat a timeout as "not signed in": protected routes then send
  // the visitor to /sign-in (recoverable) instead of erroring, and
  // public pages render normally.
  const user = await withTimeout(
    supabase.auth
      .getUser()
      .then(({ data }) => data.user)
      .catch(() => null),
    AUTH_TIMEOUT_MS
  )

  return { response: supabaseResponse, user }
}

const AUTH_TIMEOUT_MS = 3000

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          console.warn('[middleware] supabase auth.getUser timed out')
          resolve(null)
        }, ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
