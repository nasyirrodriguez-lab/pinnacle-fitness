import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { needsOnboarding } from '@/lib/auth/onboarding'
import OnboardingForm from '@/components/onboarding/onboarding-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Welcome — The Worx',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ next?: string }>
}

function safeNext(next: string | undefined): string | undefined {
  if (!next) return undefined
  if (!next.startsWith('/') || next.startsWith('//')) return undefined
  return next
}

export default async function WelcomePage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const { next } = await searchParams
  const safe = safeNext(next)

  // If they're already fully onboarded, no reason to be here.
  if (!needsOnboarding(user)) {
    redirect(safe ?? '/dashboard')
  }

  const firstName = (user.fullName ?? '').split(' ')[0]
  const greeting = firstName ? `Welcome, ${firstName}` : 'Welcome to The Worx'

  return (
    <div className="bg-neutral-50 min-h-[calc(100vh-200px)] py-12 md:py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-turquoise-700 uppercase tracking-wide mb-2">
            One last step
          </p>
          <h1 className="font-heading text-3xl md:text-4xl mb-2">{greeting}</h1>
          <p className="text-neutral-600 max-w-md mx-auto">
            Confirm your name and contact number, and accept our terms to finish
            setting up your account.
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6 md:p-8">
          <OnboardingForm
            defaultFullName={user.fullName ?? ''}
            defaultPhone={user.phone ?? ''}
            next={safe}
          />
        </div>
      </div>
    </div>
  )
}
