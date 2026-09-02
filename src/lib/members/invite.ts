import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { Designation } from '@/lib/members/designations'

// Shared account-creation used by the admin "add member" form and the
// kiosk "become a member" flow. Creates the auth user via the normal
// magic-link path (so Supabase sends the standard sign-in email), then
// pre-fills the profile. The member finishes onboarding — terms +
// selfie — from the link on their own phone.

export interface InviteMemberArgs {
  email: string
  fullName: string
  phone?: string | null
  designation?: Designation | null
  next?: string
}

export type InviteMemberResult =
  | { ok: true; userId: string }
  | { ok: false; error: string }

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'http://localhost:3000'
  )
}

export async function inviteMember(
  args: InviteMemberArgs
): Promise<InviteMemberResult> {
  const email = args.email.toLowerCase().trim()
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('profiles')
    .select('id, terms_accepted_at')
    .eq('email', email)
    .maybeSingle()
  if (existing) {
    return {
      ok: false,
      error: 'That email already has an account.',
    }
  }

  const callbackUrl = new URL('/auth/callback', getSiteUrl())
  callbackUrl.searchParams.set('next', args.next ?? '/welcome')

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: true,
    },
  })
  if (otpErr) {
    console.error('[members/invite] signInWithOtp failed:', otpErr)
    const code = (otpErr as { code?: string }).code
    return {
      ok: false,
      error:
        code === 'over_email_send_rate_limit'
          ? 'Too many emails just went out. Wait a minute and try again.'
          : 'Could not send the invite email. Try again.',
    }
  }

  // The auth trigger has created the profile row; stamp what we know.
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (!profile) {
    // Email went out either way — the profile appears on first sign-in.
    console.warn('[members/invite] profile not found after OTP:', email)
    return {
      ok: false,
      error:
        'Invite sent, but profile setup lagged. Check the members list in a minute.',
    }
  }
  const userId = (profile as { id: string }).id

  const { error: updateErr } = await admin
    .from('profiles')
    .update({
      full_name: args.fullName.trim(),
      phone: args.phone?.trim() || null,
      ...(args.designation ? { designation: args.designation } : {}),
    })
    .eq('id', userId)
  if (updateErr) {
    console.warn('[members/invite] profile prefill failed:', updateErr)
  }

  return { ok: true, userId }
}
