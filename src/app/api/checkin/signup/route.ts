import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPairedDevice } from '@/lib/checkin/kiosk-auth'
import { inviteMember } from '@/lib/members/invite'

// Kiosk "become a member": collects name/email/phone on the iPad,
// creates the account, and emails a magic link so the new member
// finishes onboarding (terms + selfie) on their own phone.

const signupSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().email('A valid email is required').max(200),
  phone: z
    .string()
    .trim()
    .min(7, 'A contact number is required')
    .max(40)
    .regex(/^\+?[\d\s\-()]{7,}$/, 'Enter a valid phone number'),
})

export async function POST(request: NextRequest) {
  const device = await getPairedDevice()
  if (!device) {
    return NextResponse.json({ error: 'kiosk_not_paired' }, { status: 401 })
  }

  let body
  try {
    body = signupSchema.parse(await request.json())
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid details')
        : 'Invalid details'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await inviteMember({
    email: body.email,
    fullName: body.fullName,
    phone: body.phone,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ status: 'invited' })
}
