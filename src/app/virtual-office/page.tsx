import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { ArrowRight, MapPin, MailOpen, ShieldCheck, Camera } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createAdminClient } from '@/utils/supabase/admin'
import VirtualOfficeSignupForm from '@/components/virtual-office/signup-form'
import { VO_REGISTERED_ADDRESS } from '@/config/virtual-office'
import { loadLatestDocsByKind } from '@/lib/virtual-office/documents'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Virtual Office | The Worx',
  description:
    'A registered business address in Port of Spain with professional mail handling. Operated by The Worx.',
}

async function loadPlan() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data } = await supabase
    .from('plans')
    .select('id, name, price_cents, currency, billing_period, features')
    .eq('id', 'virtual-office-monthly')
    .eq('is_active', true)
    .maybeSingle()
  if (!data) return null
  const r = data as Record<string, unknown>
  return {
    name: r.name as string,
    priceCents: r.price_cents as number,
    currency: r.currency as string,
    billingPeriod: r.billing_period as string,
    features: Array.isArray(r.features) ? (r.features as string[]) : [],
  }
}

async function loadExistingVO(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('virtual_office_subscriptions')
    .select('id, business_name, is_active, created_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  const r = data as Record<string, unknown>
  return {
    businessName: r.business_name as string,
    isActive: (r.is_active as boolean) ?? false,
    createdAt: r.created_at as string,
  }
}

function fmtPrice(cents: number, currency: string): string {
  return `${currency} $${(cents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

export default async function VirtualOfficePage() {
  const [plan, user] = await Promise.all([loadPlan(), getCurrentUser()])
  const existing = user ? await loadExistingVO(user.id) : null
  const initialDocs = user
    ? Array.from(
        (await loadLatestDocsByKind(createAdminClient(), user.id)).values()
      )
        .filter((d) => d.kind !== 'other')
        .map((d) => ({
          id: d.id,
          // Narrow away 'other' — loadLatestDocsByKind already excludes
          // it, this is just for the type system.
          kind: d.kind as Exclude<typeof d.kind, 'other'>,
          status: d.status,
          original_filename: d.original_filename,
          created_at: d.created_at,
        }))
    : []

  const planLabel = plan
    ? `${fmtPrice(plan.priceCents, plan.currency)} / ${plan.billingPeriod}`
    : 'Available — see /spaces'

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
      <div className="mb-12">
        <p className="text-sm font-medium text-turquoise-700 uppercase tracking-wide mb-2">
          Virtual Office
        </p>
        <h1 className="font-heading text-4xl md:text-5xl mb-4">
          A professional address.
          <br />
          Without renting an office.
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl">
          Use The Worx as your registered business address in Port of Spain. We
          handle the mail. You focus on the business.
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6 md:p-8 mb-12">
        <div className="flex items-start gap-4">
          <MapPin size={20} className="text-turquoise-700 shrink-0 mt-1" />
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
              Your registered address
            </p>
            <p className="font-heading text-xl">{VO_REGISTERED_ADDRESS}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <Camera size={20} className="text-turquoise-700 mb-3" />
          <h3 className="font-heading text-base mb-2">Mail photographed</h3>
          <p className="text-sm text-neutral-600">
            Every piece of mail received is photographed and logged within one
            business day.
          </p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <MailOpen size={20} className="text-turquoise-700 mb-3" />
          <h3 className="font-heading text-base mb-2">Notified instantly</h3>
          <p className="text-sm text-neutral-600">
            You get an email + a notification in your dashboard inbox the moment
            a piece of mail is logged.
          </p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <ShieldCheck size={20} className="text-turquoise-700 mb-3" />
          <h3 className="font-heading text-base mb-2">Pick up or forward</h3>
          <p className="text-sm text-neutral-600">
            Collect in person, or ask us to forward (additional fee). Mail stays
            with us for 30 days.
          </p>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="p-6 md:p-8 border-b border-neutral-200">
          <p className="text-xs uppercase tracking-wide text-turquoise-700 font-medium mb-2">
            Sign up
          </p>
          <h2 className="font-heading text-2xl md:text-3xl mb-2">
            {plan?.name ?? 'Virtual Office'}
          </h2>
          <p className="text-sm text-neutral-600">
            {planLabel} · First month charged today
          </p>
        </div>

        <div className="p-6 md:p-8">
          {existing ? (
            <div className="rounded-md border border-turquoise-200 bg-turquoise-50 px-4 py-3 text-sm">
              <p className="font-medium mb-1">
                You&apos;re already registered for Virtual Office.
              </p>
              <p className="text-neutral-700 mb-3">
                Business: <strong>{existing.businessName}</strong>
                {!existing.isActive && ' (inactive)'}
              </p>
              <Link
                href="/dashboard/mail"
                className="inline-flex items-center gap-1 text-sm font-medium text-turquoise-700 hover:text-turquoise-900"
              >
                Go to your mail inbox
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : !user ? (
            <div>
              <p className="text-sm text-neutral-600 mb-4">
                You&apos;ll need to sign in first. We&apos;ll bring you straight
                back here.
              </p>
              <Link
                href={`/sign-in?next=${encodeURIComponent('/virtual-office')}`}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 bg-turquoise-500 hover:bg-turquoise-600 text-white font-medium rounded-md transition"
              >
                Sign in to continue
              </Link>
            </div>
          ) : !plan ? (
            <p className="text-sm text-neutral-500">
              Virtual Office is not currently available. Email{' '}
              <a
                href="mailto:team@theworx.io"
                className="text-turquoise-700 underline"
              >
                team@theworx.io
              </a>
              .
            </p>
          ) : (
            <VirtualOfficeSignupForm
              priceLabel={fmtPrice(plan.priceCents, plan.currency)}
              defaultName={user.fullName ?? ''}
              defaultCompany={user.company ?? ''}
              initialDocuments={initialDocs}
            />
          )}
        </div>
      </div>

      <p className="mt-8 text-xs text-neutral-500">
        Questions before signing up? Email{' '}
        <a
          href="mailto:team@theworx.io?subject=Virtual%20Office%20inquiry"
          className="text-turquoise-700 underline"
        >
          team@theworx.io
        </a>
        .
      </p>
    </div>
  )
}
