import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { needsOnboarding } from '@/lib/auth/onboarding'
import OnboardingForm from '@/components/onboarding/onboarding-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'You’re in — Pinnacle Fitness',
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
  if (!needsOnboarding(user)) redirect(safe ?? '/dashboard')

  return (
    <div className="bg-background min-h-screen px-5 py-8 sm:px-8">
      <div className="max-w-2xl mx-auto">
        <OnboardingForm
          defaultFullName={user.fullName ?? ''}
          defaultPhone={user.phone ?? ''}
          next={safe}
        />
      </div>
    </div>
  )
}
