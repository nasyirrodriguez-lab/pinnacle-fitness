import Link from 'next/link'
import { verifyToken } from '@/lib/jwt'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Unsubscribe — Pinnacle Fitness',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ t?: string }>
}

interface TokenPayload {
  email: string
  iat?: number
}

async function processUnsubscribe(
  token: string
): Promise<{ ok: true; email: string } | { ok: false; reason: string }> {
  const payload = verifyToken<TokenPayload>(token)
  if (!payload || typeof payload.email !== 'string') {
    return { ok: false, reason: 'Invalid or expired link.' }
  }
  const email = payload.email.toLowerCase().trim()
  if (email.length === 0) {
    return { ok: false, reason: 'Invalid link.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('unsubscribes')
    .upsert(
      { email, scope: 'broadcast' },
      { onConflict: 'email', ignoreDuplicates: false }
    )
  if (error) {
    console.error('[unsubscribe] insert failed:', error)
    return { ok: false, reason: 'Could not save your preference.' }
  }

  return { ok: true, email }
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { t } = await searchParams
  const result = t
    ? await processUnsubscribe(t)
    : { ok: false as const, reason: 'No token provided.' }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-white border border-neutral-200 rounded-lg p-8 text-center">
        {result.ok ? (
          <>
            <h1 className="font-heading text-2xl mb-2">
              You&apos;re unsubscribed
            </h1>
            <p className="text-neutral-600 mb-6">
              <span className="font-medium text-neutral-900">
                {result.email}
              </span>{' '}
              will no longer receive broadcast emails from Pinnacle Fitness.
              You&apos;ll still get important account-related emails (sign-in
              links, payment confirmations, booking confirmations).
            </p>
            <p className="text-sm text-neutral-500">
              Changed your mind?{' '}
              <a
                href="mailto:hello@pinnaclefitness.app?subject=Re-subscribe%20to%20Pinnacle%20updates"
                className="text-turquoise-700 underline"
              >
                Email us to resubscribe
              </a>
              .
            </p>
            <p className="mt-6">
              <Link
                href="/"
                className="text-sm text-turquoise-700 underline font-medium"
              >
                Back to Pinnacle Fitness
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="font-heading text-2xl mb-2">Link not valid</h1>
            <p className="text-neutral-600 mb-6">{result.reason}</p>
            <p className="text-sm text-neutral-500">
              To unsubscribe, reply to any recent email from us or write to{' '}
              <a
                href="mailto:hello@pinnaclefitness.app"
                className="text-turquoise-700 underline"
              >
                hello@pinnaclefitness.app
              </a>
              .
            </p>
          </>
        )}
      </div>
    </div>
  )
}
