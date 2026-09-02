import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requestLinkSchema } from '@/lib/schemas/auth'
import { createClient } from '@/utils/supabase/server'

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'http://localhost:3000'
  )
}

export async function POST(request: NextRequest) {
  let data
  try {
    data = requestLinkSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const email = data.email.toLowerCase().trim()
  const next = data.next?.startsWith('/') ? data.next : undefined

  const callbackUrl = new URL('/auth/callback', getSiteUrl())
  if (next) callbackUrl.searchParams.set('next', next)

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: true,
    },
  })

  if (error) {
    console.error('[auth/request-link] supabase error:', error)
    const code = (error as { code?: string }).code
    if (code === 'over_email_send_rate_limit') {
      return NextResponse.json(
        {
          error:
            'Wait a few seconds before requesting another link, then try again.',
        },
        { status: 429 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to send sign-in link. Try again in a moment.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
