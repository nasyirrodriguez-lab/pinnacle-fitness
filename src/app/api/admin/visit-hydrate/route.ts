import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { signedVisitorPhotoUrl } from '@/lib/photos/upload'

// Admin-only: hydrate a single visit row with the joined profile's
// display name + a short-lived signed URL for the selfie. Used by the
// live-feed client component when a Realtime INSERT comes in.

const bodySchema = z.object({ visitId: z.string().uuid() })

interface VisitJoinRow {
  id: string
  user_id: string | null
  guest_name: string | null
  guest_email: string | null
  selfie_path: string | null
  profiles:
    | {
        full_name: string | null
        email: string
        selfie_path: string | null
      }
    | { full_name: string | null; email: string; selfie_path: string | null }[]
    | null
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || (profile as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'admin_only' }, { status: 403 })
  }

  let body
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('visits')
    .select(
      'id, user_id, guest_name, guest_email, selfie_path, profiles!visits_user_id_fkey(full_name, email, selfie_path)'
    )
    .eq('id', body.visitId)
    .maybeSingle()
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const row = data as unknown as VisitJoinRow
  const profileRow = Array.isArray(row.profiles)
    ? (row.profiles[0] ?? null)
    : row.profiles

  // Prefer the visit's own selfie (taken at check-in) over the member's
  // profile selfie.
  const path = row.selfie_path ?? profileRow?.selfie_path ?? null
  const signed = path ? await signedVisitorPhotoUrl(path) : null

  return NextResponse.json({
    display_name:
      profileRow?.full_name ??
      row.guest_name ??
      profileRow?.email ??
      row.guest_email,
    profile_email: profileRow?.email ?? null,
    profile_selfie_path: path,
    signed_selfie_url: signed,
  })
}
