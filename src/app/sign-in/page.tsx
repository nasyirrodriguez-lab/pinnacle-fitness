import type { Metadata } from 'next'
import Link from 'next/link'
import SignInForm from '@/components/sign-in-form/sign-in-form'

export const metadata: Metadata = {
  title: 'Sign in — Pinnacle Fitness',
  description: 'Sign in to your member dashboard.',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ next?: string; error?: string }>
}

const ERROR_MESSAGES: Record<string, string> = {
  expired:
    'That sign-in link expired. Request a new one — links are valid for a few minutes.',
  invalid: 'That sign-in link is invalid or has already been used.',
  missing: 'No sign-in token. Request a new link below.',
  'used-or-expired':
    'That sign-in link is no longer valid. This happens if it was already used, has expired, or your email provider previewed it. Request a fresh one below.',
  'wrong-browser':
    'Looks like the link opened in a different browser than the one you requested it from. Request a new link below and open it in the same browser — the link expires the moment any preview clicks it.',
}

export default async function SignInPage({ searchParams }: PageProps) {
  const { next, error } = await searchParams
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : undefined
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="heading-display text-4xl mb-2">Welcome back</h1>
          <p className="text-neutral-600">
            Your QR, your bookings, your sessions. We&apos;ll email you a
            one-time link or a 6-digit code — no password.
          </p>
        </div>
        {errorMessage && (
          <div className="mb-4 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            {errorMessage}
          </div>
        )}
        <div className="bg-white border border-neutral-200 rounded-lg p-8 shadow-sm">
          <SignInForm next={safeNext} />
        </div>

        <p className="text-sm text-neutral-600 text-center mt-6">
          Not a member yet?{' '}
          <Link href="/apply" className="text-turquoise-700 underline font-medium">
            Apply to join
          </Link>
        </p>
      </div>
    </div>
  )
}
