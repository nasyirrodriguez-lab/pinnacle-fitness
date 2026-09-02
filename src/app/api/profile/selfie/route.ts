import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { saveVisitorPhoto } from '@/lib/photos/upload'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const form = await request.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const selfie = form.get('selfie')
  if (!(selfie instanceof File) || selfie.size === 0) {
    return NextResponse.json({ error: 'Missing selfie' }, { status: 400 })
  }

  const result = await saveVisitorPhoto({
    blob: selfie,
    folder: `members/${user.id}`,
    size: selfie.size,
    mime: selfie.type,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  // Persist the path on the profile so future flows (kiosk recognition,
  // admin view) can reference it without another upload.
  const { error } = await supabase
    .from('profiles')
    .update({ selfie_path: result.path })
    .eq('id', user.id)
  if (error) {
    console.error('[profile/selfie] update failed:', error)
    return NextResponse.json(
      { error: 'Could not save selfie reference' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, path: result.path })
}
