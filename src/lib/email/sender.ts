// Single source for the Resend `from` field.
//
// theworx.space is verified in the Resend account today, so it is the
// production fallback. Once mail.theworx.io finishes DNS verification,
// set RESEND_FROM="The Worx <noreply@mail.theworx.io>" in Vercel.
// onboarding@resend.dev is Resend's testing mode — it can only deliver
// to the account owner's inbox, which silently killed every member
// email — so a resend.dev override is honored only in development.
const VERIFIED_FROM = 'The Worx <hello@theworx.space>'

export function getEmailFrom(): string {
  const configured = process.env.RESEND_FROM
  if (configured && !configured.includes('resend.dev')) return configured
  if (process.env.NODE_ENV !== 'production' && configured) return configured
  return VERIFIED_FROM
}
