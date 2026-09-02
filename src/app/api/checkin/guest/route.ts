import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { createAdminClient } from '@/utils/supabase/admin'
import { saveVisitorPhoto } from '@/lib/photos/upload'

const fieldsSchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(200),
  email: z
    .string()
    .email('Enter a valid email')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: z.string().max(50).optional(),
  reason: z.string().max(500).optional(),
  hostUserId: z.string().uuid().optional(),
  kind: z.enum(['guest', 'tour']).default('guest'),
  // Everyone checking in accepts the T&Cs — the wizard can't submit
  // without it, and the API refuses to record a visit without it.
  termsAccepted: z.literal('true', {
    message: 'You must accept the terms and conditions to check in.',
  }),
})

export async function POST(request: NextRequest) {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  // The kiosk wizard submits multipart/form-data so we can stream the selfie
  // JPEG alongside the form fields. Selfie is optional at the API layer
  // (the form may submit without one if camera access was refused), but
  // the wizard UI requires it before allowing submit.
  const form = await request.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  let body
  try {
    body = fieldsSchema.parse({
      fullName: form.get('fullName'),
      email: form.get('email') ?? undefined,
      phone: form.get('phone') ?? undefined,
      reason: form.get('reason') ?? undefined,
      hostUserId: form.get('hostUserId') ?? undefined,
      kind: form.get('kind') ?? 'guest',
      termsAccepted: form.get('termsAccepted'),
    })
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'invalid_request')
        : 'invalid_request'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  let selfiePath: string | null = null
  const selfie = form.get('selfie')
  if (selfie instanceof File && selfie.size > 0) {
    const result = await saveVisitorPhoto({
      blob: selfie,
      folder: `guests/${new Date().toISOString().slice(0, 10)}`,
      size: selfie.size,
      mime: selfie.type,
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }
    selfiePath = result.path
  }

  const admin = createAdminClient()
  const { data: visit, error } = await admin
    .from('visits')
    .insert({
      kind: body.kind,
      guest_name: body.fullName.trim(),
      guest_email: body.email ?? null,
      guest_phone: body.phone?.trim() || null,
      host_user_id: body.hostUserId ?? null,
      reason: body.reason?.trim() || null,
      device_id: device.id,
      selfie_path: selfiePath,
      terms_accepted_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !visit) {
    console.error('[checkin/guest] insert failed:', error)
    return NextResponse.json({ error: 'visit_insert_failed' }, { status: 500 })
  }

  return NextResponse.json({
    status: 'checked_in',
    visitId: (visit as { id: string }).id,
  })
}
