import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Membership by application — Pinnacle Fitness',
  description:
    'Pinnacle isn’t a first gym. Membership is by application — apply, come in for an intro session, and we’ll take it from there.',
  robots: { index: true, follow: true },
}

// There is no public sign-up. Accounts are created when an application
// is approved; this page just points people the right way.
export default function SignUpPage() {
  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <p className="text-[11px] tracking-[0.18em] uppercase text-turf mb-3">
          Membership by application
        </p>
        <h1 className="heading-display text-4xl sm:text-5xl mb-4">
          Pinnacle isn’t
          <br />a first gym.
        </h1>
        <p className="text-ice-dim mb-8">
          Our sessions are coached and progressive, so we look for people who
          already train and want to be pushed further. Apply, come in for an
          intro session, and if it’s a fit you’ll get your account, your app,
          and your first booking.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/apply"
            className="h-14 rounded-full bg-primary text-primary-foreground font-heading text-sm inline-flex items-center justify-center"
          >
            Apply to join
          </Link>
          <Link
            href="/sign-in"
            className="h-14 rounded-full border border-ice text-ice font-heading text-sm inline-flex items-center justify-center"
          >
            Already a member? Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
