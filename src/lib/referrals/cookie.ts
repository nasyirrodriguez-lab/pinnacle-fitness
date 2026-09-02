import { cookies } from 'next/headers'

// The pending referral code lives in a 30-day cookie set when a friend
// opens pinnaclefitness.app/r/<code>. We read it during completeOnboarding() and
// clear it afterwards.

export const REF_COOKIE = 'worx_ref'
const REF_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days

export async function setReferralCookie(code: string): Promise<void> {
  const store = await cookies()
  store.set(REF_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REF_COOKIE_MAX_AGE,
  })
}

export async function readReferralCookie(): Promise<string | null> {
  const store = await cookies()
  return store.get(REF_COOKIE)?.value ?? null
}

export async function clearReferralCookie(): Promise<void> {
  const store = await cookies()
  store.delete(REF_COOKIE)
}
