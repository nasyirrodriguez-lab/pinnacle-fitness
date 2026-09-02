import type { Metadata } from 'next'
import Link from 'next/link'
import SignInForm from '@/components/sign-in-form/sign-in-form'

export const metadata: Metadata = {
  title: 'Sign up — The Worx',
  description:
    'Join The Worx coworking community in Port of Spain. Sign up with your email — no password required.',
  robots: { index: true, follow: true },
}

interface PageProps {
  searchParams: Promise<{
    next?: string
    error?: string
    referred?: string
  }>
}

const ERROR_MESSAGES: Record<string, string> = {
  expired:
    'That sign-up link expired. Request a new one — links are valid for a few minutes.',
  invalid: 'That sign-up link is invalid or has already been used.',
  missing: 'No sign-up token. Request a new link below.',
}

export default async function SignUpPage({ searchParams }: PageProps) {
  const { next, error, referred } = await searchParams
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : undefined
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined
  const isReferred = referred === '1'

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-turquoise-700 uppercase tracking-wide mb-2">
            Join The Worx
          </p>
          <h1 className="font-heading text-3xl mb-2">Create your account</h1>
          <p className="text-neutral-600">
            We&apos;ll email you a one-time link. No password required.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            {errorMessage}
          </div>
        )}

        {isReferred && (
          <div className="mb-4 rounded-md border border-turquoise-200 bg-turquoise-50 px-4 py-3 text-sm text-turquoise-900">
            <p className="font-medium mb-0.5">
              You were referred by a Worx member.
            </p>
            <p className="text-xs">
              Sign up and make your first purchase — you both get a free Day
              Pass.
            </p>
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded-lg p-8 shadow-sm">
          <SignInForm next={safeNext} mode="sign-up" />
        </div>

        <p className="text-sm text-neutral-600 text-center mt-6">
          Already a member?{' '}
          <Link
            href={
              safeNext
                ? `/sign-in?next=${encodeURIComponent(safeNext)}`
                : '/sign-in'
            }
            className="text-turquoise-700 underline font-medium"
          >
            Sign in
          </Link>
        </p>

        <p className="text-xs text-neutral-500 text-center mt-4">
          By continuing you&apos;ll review and accept our{' '}
          <Link href="/terms" className="underline">
            Terms and Conditions
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
