import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

const bodySchema = z.object({
  email: z.string().email('Enter a valid email'),
  code: z.string().regex(/^\d{6,8}$/, 'Enter the code from your email'),
  next: z.string().optional(),
})

function safeNext(next: string | undefined): string {
  if (!next) return '/dashboard'
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard'
  return next
}

export async function POST(request: NextRequest) {
  let data
  try {
    data = bodySchema.parse(await request.json())
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid request')
        : 'Invalid request'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // verifyOtp with type 'email' accepts both the 6-digit code and the
  // hashed token from a magic link. This codepath is the cross-browser
  // fallback: the user opens the email in any client, copies the code,
  // and pastes it back into the browser tab they started in.
  const { error } = await supabase.auth.verifyOtp({
    email: data.email.toLowerCase().trim(),
    token: data.code,
    type: 'email',
  })

  if (error) {
    const message = error.message.toLowerCase().includes('expired')
      ? 'That code expired. Request a new one.'
      : 'That code is invalid. Double-check and try again.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, next: safeNext(data.next) })
}
