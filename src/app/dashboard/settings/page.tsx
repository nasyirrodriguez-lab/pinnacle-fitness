import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import SignOutButton from '@/components/sign-out-button/sign-out-button'
import ProfileForm from '@/components/settings/profile-form'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Settings</h1>
        <p className="text-neutral-600">
          Edit your contact details, install the app, or sign out.
        </p>
      </div>

      <section className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
        <h2 className="font-heading text-lg mb-4">Profile</h2>
        <ProfileForm
          email={user.email}
          defaultValues={{
            fullName: user.fullName ?? '',
            phone: user.phone ?? '',
            company: user.company ?? '',
          }}
        />
      </section>

      {user.role === 'admin' && (
        <section className="bg-darkBlue-900 text-white rounded-lg p-6 mb-6">
          <h2 className="font-heading text-lg mb-2">Admin tools</h2>
          <p className="text-sm text-white/80 mb-4">
            You have admin access. Manage members, bookings, and the catalog.
          </p>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white text-darkBlue-900 text-sm font-medium hover:bg-neutral-100 transition"
          >
            Open admin interface
          </Link>
        </section>
      )}

      <section className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
        <h2 className="font-heading text-lg mb-2">Install the app</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Add The Worx to your home screen for one-tap check-in, your QR code,
          and bookings. Works on iPhone and Android — no app store download.
        </p>
        <Link
          href="/install"
          className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-neutral-200 text-sm font-medium hover:bg-neutral-50 transition"
        >
          Show me how
        </Link>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
        <h2 className="font-heading text-lg mb-3">Sign out</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Signs you out of this browser. You can sign in again any time with
          your email — no password needed.
        </p>
        <SignOutButton />
      </section>

      <p className="text-sm text-neutral-500">
        Looking for your plan, passes, or invoices?{' '}
        <Link
          href="/dashboard/account"
          className="text-turquoise-700 underline"
        >
          See Account
        </Link>
        . Browse{' '}
        <Link href="/pricing" className="text-turquoise-700 underline">
          plans
        </Link>{' '}
        or review the{' '}
        <Link href="/terms" className="text-turquoise-700 underline">
          Terms and Conditions
        </Link>
        .
      </p>
    </div>
  )
}
