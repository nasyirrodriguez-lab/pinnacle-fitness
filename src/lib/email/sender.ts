// Single source for the Resend `from` field.
//
// Set RESEND_FROM in Vercel once pinnaclefitness.app is verified in Resend
// (e.g. "Pinnacle Fitness <hello@pinnaclefitness.app>"). Until then the
// fallback below must be a domain the Resend account has verified.
// onboarding@resend.dev is Resend's testing mode — it can only deliver
// to the account owner's inbox — so a resend.dev override is honored
// only in development.
const VERIFIED_FROM = 'Pinnacle Fitness <hello@theworx.space>'

export function getEmailFrom(): string {
  const configured = process.env.RESEND_FROM
  if (configured && !configured.includes('resend.dev')) return configured
  if (process.env.NODE_ENV !== 'production' && configured) return configured
  return VERIFIED_FROM
}
