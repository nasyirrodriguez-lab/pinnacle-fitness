import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ChevronLeft, Coins, User } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { parseTstzRange } from '@/lib/booking/slots'
import {
  benefitHoursPerMonth,
  parseRoomBenefits,
  planRoomUsage,
} from '@/lib/booking/plan-benefits'
import { getCreditBalanceCents } from '@/lib/credits/balance'
import { signedVisitorPhotoUrl } from '@/lib/photos/upload'
import { fmtAstDate, fmtAstDateTime } from '@/lib/time/ast'
import AdminMemberForm from '@/components/admin/admin-member-form'
import AdminNoteForm from '@/components/admin/admin-note-form'
import AdminSubscriptionControls from '@/components/admin/admin-subscription-controls'
import AdminRoomCreditsCard, {
  type RoomCreditRow,
} from '@/components/admin/admin-room-credits-card'
import AdminDirectCreditForm from '@/components/admin/admin-direct-credit-form'
import AdminAddonsCard, {
  type AddonRow,
} from '@/components/admin/admin-addons-card'
import AdminRequestPaymentCard, {
  type RequestableProduct,
} from '@/components/admin/admin-request-payment-card'
import AdminPaymentRequestsList from '@/components/admin/admin-payment-requests-list'
import { effectivePrice } from '@/lib/pricing/effective'
import {
  loadDesignationRoles,
  roleLabel,
  type Designation,
} from '@/lib/members/designations'
import PassRowEditor, {
  type PassAdjustmentEntry,
} from '@/components/admin/pass-row-editor'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

interface MemberDetail {
  id: string
  email: string
  fullName: string | null
  phone: string | null
  company: string | null
  address: string | null
  city: string | null
  pincode: string | null
  role: 'member' | 'admin'
  designation: Designation | null
  archived: boolean
  createdAt: string
  registeredAt: string | null
  lastSignInAt: string | null
  termsVersion: string | null
  termsAcceptedAt: string | null
  nexudusId: string | null
  selfieUrl: string | null
}

interface PassRow {
  id: string
  passId: string
  passName: string
  usesTotal: number
  usesRemaining: number
  expiresAt: string
  purchasedAt: string
  adjustments: PassAdjustmentEntry[]
}

interface BookingRow {
  id: string
  resourceName: string
  startIso: string
  endIso: string
  status: string
  priceCents: number
  notes: string | null
}

interface PaymentRow {
  id: string
  amountCents: number
  currency: string
  status: string
  kind: string
  paidAt: string | null
  createdAt: string
  paymentMethod: string | null
  productLabel: string | null
}

interface VisitRow {
  id: string
  checkedInAt: string
  checkedOutAt: string | null
  kind: string
  reason: string | null
}

interface AdminNoteRow {
  id: string
  body: string
  authorName: string | null
  createdAt: string
}

interface CreditGrantRow {
  id: string
  amountCents: number
  reason: string
  reasonNote: string | null
  expiresAt: string
  attachedAt: string | null
  createdAt: string
}

interface CreditLedgerRow {
  id: string
  amountCents: number
  balanceAfterCents: number
  reason: string
  paymentId: string | null
  createdAt: string
}

interface CreditState {
  balanceCents: number
  grants: CreditGrantRow[]
  ledger: CreditLedgerRow[]
}

interface SubscriptionInfo {
  id: string
  planName: string
  status: string
  currentPeriodEnd: string
  lapsed: boolean
}

interface PlanUsageRow {
  resourceId: string
  hoursPerMonth: number
  hoursUsed: number
}

interface VirtualOfficeInfo {
  businessName: string
  forwardingEmail: string | null
  isActive: boolean
}

async function loadCredits(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<CreditState> {
  const [balanceCents, { data: grantsData }, { data: ledgerData }] =
    await Promise.all([
      getCreditBalanceCents(admin, userId),
      admin
        .from('credit_grants')
        .select(
          'id, amount_cents, reason, reason_note, expires_at, attached_at, created_at'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      admin
        .from('credit_ledger')
        .select(
          'id, amount_cents, balance_after_cents, reason, payment_id, created_at'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
  const grants: CreditGrantRow[] = (
    (grantsData as Record<string, unknown>[] | null) ?? []
  ).map((r) => ({
    id: r.id as string,
    amountCents: r.amount_cents as number,
    reason: r.reason as string,
    reasonNote: (r.reason_note as string | null) ?? null,
    expiresAt: r.expires_at as string,
    attachedAt: (r.attached_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }))
  const ledger: CreditLedgerRow[] = (
    (ledgerData as Record<string, unknown>[] | null) ?? []
  ).map((r) => ({
    id: r.id as string,
    amountCents: r.amount_cents as number,
    balanceAfterCents: r.balance_after_cents as number,
    reason: r.reason as string,
    paymentId: (r.payment_id as string | null) ?? null,
    createdAt: r.created_at as string,
  }))
  return { balanceCents, grants, ledger }
}

async function loadMember(id: string) {
  const admin = createAdminClient()

  const [
    memberRes,
    passesRes,
    bookingsRes,
    paymentsRes,
    notesRes,
    credits,
    authRes,
    visitsRes,
    subscriptionRes,
    voRes,
    roomCreditsRes,
    resourcesRes,
    addonsRes,
    planProductsRes,
    passProductsRes,
  ] = await Promise.all([
    admin
      .from('profiles')
      .select(
        'id, email, full_name, phone, company, address, city, pincode, role, designation, archived, created_at, registered_at, terms_version, terms_accepted_at, nexudus_id, selfie_path'
      )
      .eq('id', id)
      .maybeSingle(),
    admin
      .from('pass_purchases')
      .select(
        'id, pass_id, uses_total, uses_remaining, expires_at, purchased_at, passes(name)'
      )
      .eq('user_id', id)
      .order('purchased_at', { ascending: false })
      .limit(20),
    admin
      .from('bookings')
      .select('id, during, status, price_cents, notes, resources(name)')
      .eq('user_id', id)
      .order('during', { ascending: false })
      .limit(20),
    admin
      .from('payments')
      .select(
        'id, amount_cents, currency, status, kind, paid_at, created_at, payment_method, metadata'
      )
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('admin_notes')
      .select(
        'id, body, created_at, profiles!admin_notes_author_id_fkey(full_name, email)'
      )
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
    loadCredits(admin, id),
    admin.auth.admin.getUserById(id),
    admin
      .from('visits')
      .select('id, checked_in_at, checked_out_at, kind, reason')
      .eq('user_id', id)
      .order('checked_in_at', { ascending: false })
      .limit(20),
    admin
      .from('subscriptions')
      .select(
        'id, plan_id, status, current_period_end, plans(name, room_benefits)'
      )
      .eq('user_id', id)
      .in('status', ['active', 'past_due', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1),
    admin
      .from('virtual_office_subscriptions')
      .select('business_name, forwarding_email, is_active')
      .eq('user_id', id)
      .maybeSingle(),
    admin
      .from('room_hour_credits')
      .select(
        'id, resource_id, hours_granted, hours_used, expires_at, reason, resources(name)'
      )
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('resources')
      .select('id, name')
      .eq('is_bookable', true)
      .order('display_order', { ascending: true }),
    admin
      .from('member_addons')
      .select('id, label, amount_cents, expires_at')
      .eq('user_id', id)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: true }),
    admin
      .from('plans')
      .select(
        'id, name, price_cents, discounted_price_cents, discount_expires_at, is_private'
      )
      .or('is_active.eq.true,is_private.eq.true')
      .order('display_order', { ascending: true }),
    admin
      .from('passes')
      .select(
        'id, name, price_cents, discounted_price_cents, discount_expires_at, is_private'
      )
      .or('is_active.eq.true,is_private.eq.true')
      .order('display_order', { ascending: true }),
  ])

  if (memberRes.error || !memberRes.data) return null

  const m = memberRes.data as Record<string, unknown>
  const selfiePath = (m.selfie_path as string | null) ?? null
  const selfieUrl = selfiePath ? await signedVisitorPhotoUrl(selfiePath) : null
  const member: MemberDetail = {
    id: m.id as string,
    email: m.email as string,
    fullName: (m.full_name as string | null) ?? null,
    phone: (m.phone as string | null) ?? null,
    company: (m.company as string | null) ?? null,
    address: (m.address as string | null) ?? null,
    city: (m.city as string | null) ?? null,
    pincode: (m.pincode as string | null) ?? null,
    role: ((m.role as string) ?? 'member') as 'member' | 'admin',
    designation: ((m.designation as string | null) ??
      null) as MemberDetail['designation'],
    archived: (m.archived as boolean) ?? false,
    createdAt: m.created_at as string,
    registeredAt: (m.registered_at as string | null) ?? null,
    lastSignInAt:
      (authRes.data?.user?.last_sign_in_at as string | null) ?? null,
    termsVersion: (m.terms_version as string | null) ?? null,
    termsAcceptedAt: (m.terms_accepted_at as string | null) ?? null,
    nexudusId: (m.nexudus_id as string | null) ?? null,
    selfieUrl,
  }

  const passes: PassRow[] = (
    (passesRes.data as Record<string, unknown>[] | null) ?? []
  ).map((r) => {
    const pRaw = r.passes as { name?: string } | { name?: string }[] | null
    const p = Array.isArray(pRaw) ? pRaw[0] : pRaw
    return {
      id: r.id as string,
      passId: r.pass_id as string,
      passName: p?.name ?? (r.pass_id as string),
      usesTotal: r.uses_total as number,
      usesRemaining: r.uses_remaining as number,
      expiresAt: r.expires_at as string,
      purchasedAt: r.purchased_at as string,
      adjustments: [] as PassAdjustmentEntry[],
    }
  })

  // Hydrate adjustment history for each pass shown. Bounded by the
  // 20-pass cap above; one round-trip total.
  if (passes.length > 0) {
    const passIds = passes.map((p) => p.id)
    const { data: adjData } = await admin
      .from('pass_adjustments')
      .select(
        'id, pass_purchase_id, delta_uses, reason, created_at, profiles!pass_adjustments_admin_id_fkey(full_name, email)'
      )
      .in('pass_purchase_id', passIds)
      .order('created_at', { ascending: false })
    const byPass = new Map<string, PassAdjustmentEntry[]>()
    for (const raw of (adjData as Record<string, unknown>[] | null) ?? []) {
      const adminRaw = raw.profiles as
        | { full_name?: string; email?: string }
        | { full_name?: string; email?: string }[]
        | null
      const adminProfile = Array.isArray(adminRaw) ? adminRaw[0] : adminRaw
      const entry: PassAdjustmentEntry = {
        id: raw.id as string,
        deltaUses: raw.delta_uses as number,
        reason: raw.reason as string,
        adminName: adminProfile?.full_name ?? adminProfile?.email ?? null,
        createdAt: raw.created_at as string,
      }
      const key = raw.pass_purchase_id as string
      const arr = byPass.get(key) ?? []
      arr.push(entry)
      byPass.set(key, arr)
    }
    for (const p of passes) {
      p.adjustments = byPass.get(p.id) ?? []
    }
  }

  const bookings: BookingRow[] = (
    (bookingsRes.data as Record<string, unknown>[] | null) ?? []
  )
    .map((r) => {
      const range = parseTstzRange(r.during as string)
      if (!range) return null
      const resRaw = r.resources as
        | { name?: string }
        | { name?: string }[]
        | null
      const res = Array.isArray(resRaw) ? resRaw[0] : resRaw
      return {
        id: r.id as string,
        resourceName: res?.name ?? '—',
        startIso: range.during_lower,
        endIso: range.during_upper,
        status: r.status as string,
        priceCents: (r.price_cents as number) ?? 0,
        notes: (r.notes as string | null) ?? null,
      } as BookingRow
    })
    .filter((b): b is BookingRow => b !== null)

  const payments: PaymentRow[] = (
    (paymentsRes.data as Record<string, unknown>[] | null) ?? []
  ).map((r) => {
    const metadata = (r.metadata as Record<string, unknown> | null) ?? {}
    return {
      id: r.id as string,
      amountCents: r.amount_cents as number,
      currency: r.currency as string,
      status: r.status as string,
      kind: r.kind as string,
      paidAt: (r.paid_at as string | null) ?? null,
      createdAt: r.created_at as string,
      paymentMethod: (r.payment_method as string | null) ?? null,
      productLabel:
        (typeof metadata.planId === 'string' ? metadata.planId : null) ??
        (typeof metadata.passId === 'string' ? metadata.passId : null),
    }
  })

  const notes: AdminNoteRow[] = (
    (notesRes.data as Record<string, unknown>[] | null) ?? []
  ).map((r) => {
    const authorRaw = r.profiles as
      | { full_name?: string; email?: string }
      | { full_name?: string; email?: string }[]
      | null
    const author = Array.isArray(authorRaw) ? authorRaw[0] : authorRaw
    return {
      id: r.id as string,
      body: r.body as string,
      authorName: author?.full_name ?? author?.email ?? null,
      createdAt: r.created_at as string,
    }
  })

  const visits: VisitRow[] = (
    (visitsRes.data as Record<string, unknown>[] | null) ?? []
  ).map((r) => ({
    id: r.id as string,
    checkedInAt: r.checked_in_at as string,
    checkedOutAt: (r.checked_out_at as string | null) ?? null,
    kind: (r.kind as string) ?? 'member',
    reason: (r.reason as string | null) ?? null,
  }))

  const subRaw = ((subscriptionRes.data as Record<string, unknown>[] | null) ??
    [])[0]
  let subscription: SubscriptionInfo | null = null
  let planUsage: PlanUsageRow[] = []
  if (subRaw) {
    const planRaw = subRaw.plans as
      | { name?: string; room_benefits?: unknown }
      | { name?: string; room_benefits?: unknown }[]
      | null
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw
    const periodEnd = subRaw.current_period_end as string
    subscription = {
      id: subRaw.id as string,
      planName: plan?.name ?? (subRaw.plan_id as string),
      status: subRaw.status as string,
      currentPeriodEnd: periodEnd,
      lapsed: new Date(periodEnd).getTime() < Date.now(),
    }
    // What the plan includes per room and how much of it this month's
    // covered bookings have used.
    const benefits = parseRoomBenefits(plan?.room_benefits)
    planUsage = await Promise.all(
      benefits.map(async (b) => {
        const usage = await planRoomUsage(admin, {
          userId: id,
          resourceId: b.resourceId,
        })
        return {
          resourceId: b.resourceId,
          hoursPerMonth: usage?.hoursPerMonth ?? benefitHoursPerMonth(b),
          hoursUsed: usage?.hoursUsed ?? 0,
        }
      })
    )
  }

  const voRaw = voRes.data as Record<string, unknown> | null
  const virtualOffice: VirtualOfficeInfo | null = voRaw
    ? {
        businessName: voRaw.business_name as string,
        forwardingEmail: (voRaw.forwarding_email as string | null) ?? null,
        isActive: (voRaw.is_active as boolean) ?? false,
      }
    : null

  const roomCredits: RoomCreditRow[] = (
    (roomCreditsRes.data as Record<string, unknown>[] | null) ?? []
  ).map((r) => {
    const resRaw = r.resources as { name?: string } | { name?: string }[] | null
    const res = Array.isArray(resRaw) ? (resRaw[0] ?? null) : resRaw
    return {
      id: r.id as string,
      resourceName: res?.name ?? (r.resource_id as string),
      hoursGranted: Number(r.hours_granted),
      hoursUsed: Number(r.hours_used),
      expiresAt: (r.expires_at as string | null) ?? null,
      reason: (r.reason as string | null) ?? null,
    }
  })
  const bookableResources = (
    (resourcesRes.data as { id: string; name: string }[] | null) ?? []
  ).map((r) => ({ id: r.id, name: r.name }))

  const addons: AddonRow[] = (
    (addonsRes.data as Record<string, unknown>[] | null) ?? []
  ).map((r) => ({
    id: r.id as string,
    label: r.label as string,
    amountCents: r.amount_cents as number,
    expiresAt: (r.expires_at as string | null) ?? null,
  }))

  type ProductRow = {
    id: string
    name: string
    price_cents: number
    discounted_price_cents: number | null
    discount_expires_at: string | null
    is_private: boolean
  }
  const mapProducts = (
    rows: ProductRow[] | null,
    kind: 'plan' | 'pass'
  ): RequestableProduct[] =>
    (rows ?? []).map((p) => ({
      kind,
      id: p.id,
      name: p.is_private ? `${p.name} · private` : p.name,
      priceCents: effectivePrice(p).effectiveCents,
    }))
  const requestableProducts = [
    ...mapProducts(planProductsRes.data as ProductRow[] | null, 'plan'),
    ...mapProducts(passProductsRes.data as ProductRow[] | null, 'pass'),
  ]

  return {
    member,
    passes,
    bookings,
    payments,
    notes,
    credits,
    visits,
    subscription,
    virtualOffice,
    roomCredits,
    bookableResources,
    addons,
    requestableProducts,
    planUsage,
  }
}

const fmtDate = fmtAstDate
const fmtDateTime = fmtAstDateTime

function fmtPrice(cents: number, currency = 'TTD'): string {
  return `${currency} $${(cents / 100).toFixed(0)}`
}

export default async function AdminMemberDetailPage({ params }: PageProps) {
  const { id } = await params
  const [data, designationRoles] = await Promise.all([
    loadMember(id),
    loadDesignationRoles(createAdminClient()),
  ])
  if (!data) notFound()
  const {
    member,
    passes,
    bookings,
    payments,
    notes,
    credits,
    visits,
    subscription,
    virtualOffice,
    roomCredits,
    bookableResources,
    addons,
    requestableProducts,
    planUsage,
  } = data

  return (
    <div>
      <Link
        href="/admin/members"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ChevronLeft size={16} />
        All members
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <MemberAvatar
            url={member.selfieUrl}
            name={member.fullName ?? member.email}
          />
          <div className="min-w-0">
            <h1 className="font-heading text-3xl mb-1">
              {member.fullName ?? '—'}
            </h1>
            <p className="text-neutral-600">{member.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {member.role === 'admin' && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-darkBlue-900 text-white">
                  Admin
                </span>
              )}
              {member.designation && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-lime-100 text-lime-900">
                  {roleLabel(designationRoles, member.designation)}
                </span>
              )}
              {member.archived && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-neutral-200 text-neutral-700">
                  Archived
                </span>
              )}
              {member.nexudusId && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-neutral-100 text-neutral-600">
                  Nexudus ID: {member.nexudusId}
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          href={`/admin/payments/new?user=${member.id}`}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-darkBlue-900 text-white rounded-md hover:bg-darkBlue-800 shrink-0"
        >
          Record payment
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-4">Profile</h2>
            <AdminMemberForm
              userId={member.id}
              designationOptions={designationRoles}
              defaultValues={{
                fullName: member.fullName ?? '',
                phone: member.phone ?? '',
                company: member.company ?? '',
                role: member.role,
                designation: member.designation ?? 'none',
                archived: member.archived,
              }}
            />
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-1">Passes</h2>
            <p className="text-xs text-neutral-500 mb-4">
              Up to 20 most recent. Adjust uses, check the member in, or see the
              change history below each pass.
            </p>
            {passes.length === 0 ? (
              <p className="text-sm text-neutral-500">No pass purchases.</p>
            ) : (
              <ul className="space-y-0">
                {passes.map((p) => (
                  <PassRowEditor
                    key={p.id}
                    passPurchaseId={p.id}
                    passName={p.passName}
                    usesTotal={p.usesTotal}
                    usesRemaining={p.usesRemaining}
                    expiresAt={p.expiresAt}
                    purchasedAt={p.purchasedAt}
                    adjustments={p.adjustments}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-1">Room hours</h2>
            <p className="text-xs text-neutral-500 mb-4">
              Free meeting/conference room time. Bookings use these hours
              automatically before charging.
            </p>
            <AdminRoomCreditsCard
              userId={member.id}
              credits={roomCredits}
              resources={bookableResources}
            />
          </section>

          {planUsage.length > 0 && (
            <section className="bg-white border border-neutral-200 rounded-lg p-6">
              <h2 className="font-heading text-lg mb-1">
                Plan usage this month
              </h2>
              <p className="text-xs text-neutral-500 mb-4">
                Room time included in {subscription?.planName ?? 'the plan'} and
                how much is left this month.
              </p>
              <ul className="space-y-2 text-sm">
                {planUsage.map((u) => {
                  const name =
                    bookableResources.find((r) => r.id === u.resourceId)
                      ?.name ?? u.resourceId
                  const unlimited = u.hoursPerMonth >= 100000
                  const left = Math.max(0, u.hoursPerMonth - u.hoursUsed)
                  return (
                    <li
                      key={u.resourceId}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="font-medium">{name}</span>
                      <span className="text-neutral-600">
                        {unlimited
                          ? `${u.hoursUsed}h used · unlimited`
                          : `${u.hoursUsed}h used · ${left}h left of ${u.hoursPerMonth}h`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-1">Add-ons</h2>
            <p className="text-xs text-neutral-500 mb-4">
              Recurring extras charged with this member&apos;s plan.
            </p>
            <AdminAddonsCard userId={member.id} addons={addons} />
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-1">Request a payment</h2>
            <p className="text-xs text-neutral-500 mb-4">
              Assign a plan or pass — it activates automatically once the member
              pays.
            </p>
            <AdminRequestPaymentCard
              userId={member.id}
              products={requestableProducts}
              addonsTotalCents={addons.reduce((s, a) => s + a.amountCents, 0)}
            />
            <AdminPaymentRequestsList
              requests={payments
                .filter(
                  (p) =>
                    p.status === 'pending' && p.paymentMethod === 'wam_online'
                )
                .map((p) => ({
                  id: p.id,
                  amountCents: p.amountCents,
                  productLabel: p.productLabel,
                  createdAt: p.createdAt,
                }))}
            />
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-heading text-lg mb-1 flex items-center gap-2">
                  <Coins size={18} className="text-lime-700" />
                  Account credit
                </h2>
                <p className="text-2xl font-heading">
                  TTD ${(credits.balanceCents / 100).toLocaleString('en-US')}{' '}
                  available
                </p>
              </div>
              <Link
                href="/admin/credits/issue"
                className="text-xs text-darkBlue-900 hover:underline whitespace-nowrap"
              >
                Bulk issue →
              </Link>
            </div>

            <AdminDirectCreditForm userId={member.id} />
            <div className="mb-4" />

            {credits.grants.length === 0 && credits.ledger.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No credits issued to this member yet.
              </p>
            ) : (
              <>
                {credits.grants.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
                      Grants
                    </p>
                    <ul className="space-y-2">
                      {credits.grants.map((g) => (
                        <li
                          key={g.id}
                          className="flex items-center justify-between text-sm py-2 border-b border-neutral-100 last:border-0"
                        >
                          <div className="min-w-0">
                            <p className="font-medium">
                              {fmtPrice(g.amountCents)} ·{' '}
                              <span className="text-xs text-neutral-500">
                                {g.reason.replace(/_/g, ' ')}
                              </span>
                            </p>
                            {g.reasonNote && (
                              <p className="text-xs text-neutral-500">
                                {g.reasonNote}
                              </p>
                            )}
                            <p className="text-xs text-neutral-500">
                              Issued {fmtDate(g.createdAt)} · Expires{' '}
                              {fmtDate(g.expiresAt)}
                            </p>
                          </div>
                          <span
                            className={
                              g.attachedAt
                                ? 'shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-lime-100 text-lime-900'
                                : 'shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-neutral-100 text-neutral-700'
                            }
                          >
                            {g.attachedAt ? 'Attached' : 'Unclaimed'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {credits.ledger.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
                      Ledger activity
                    </p>
                    <ul className="space-y-1.5">
                      {credits.ledger.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center justify-between text-sm py-1.5 border-b border-neutral-100 last:border-0"
                        >
                          <div className="min-w-0">
                            <p className="text-sm">{row.reason}</p>
                            <p className="text-xs text-neutral-500">
                              {fmtDate(row.createdAt)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={
                                row.amountCents >= 0
                                  ? 'text-sm font-medium text-lime-700'
                                  : 'text-sm font-medium text-neutral-700'
                              }
                            >
                              {row.amountCents >= 0 ? '+' : '−'}
                              {fmtPrice(Math.abs(row.amountCents))}
                            </p>
                            <p className="text-xs text-neutral-500">
                              Bal: {fmtPrice(row.balanceAfterCents)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-1">Check-in history</h2>
            <p className="text-xs text-neutral-500 mb-4">
              Up to 20 most recent visits.
            </p>
            {visits.length === 0 ? (
              <p className="text-sm text-neutral-500">No check-ins yet.</p>
            ) : (
              <ul className="space-y-2">
                {visits.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between text-sm py-2 border-b border-neutral-100 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {fmtDateTime(v.checkedInAt)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {v.kind === 'guest' ? 'Guest' : 'Member'}
                        {v.checkedOutAt && (
                          <> · out {fmtDateTime(v.checkedOutAt)}</>
                        )}
                        {v.reason && <> · {v.reason}</>}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-1">Recent bookings</h2>
            <p className="text-xs text-neutral-500 mb-4">
              Up to 20 most recent shown.
            </p>
            {bookings.length === 0 ? (
              <p className="text-sm text-neutral-500">No bookings.</p>
            ) : (
              <ul className="space-y-2">
                {bookings.map((b) => (
                  <li
                    key={b.id}
                    className="text-sm py-2 border-b border-neutral-100 last:border-0"
                  >
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className="flex items-center justify-between gap-3 hover:bg-neutral-50 -mx-2 px-2 py-1 rounded"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{b.resourceName}</p>
                        <p className="text-xs text-neutral-500">
                          {fmtDateTime(b.startIso)} · {b.status}
                        </p>
                        {b.notes && (
                          <p className="text-xs text-neutral-600 mt-1 line-clamp-2">
                            {b.notes}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-medium whitespace-nowrap shrink-0">
                        {fmtPrice(b.priceCents)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-1">Recent payments</h2>
            <p className="text-xs text-neutral-500 mb-4">
              Up to 20 most recent shown.
            </p>
            {payments.length === 0 ? (
              <p className="text-sm text-neutral-500">No payments.</p>
            ) : (
              <ul className="space-y-2">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between text-sm py-2 border-b border-neutral-100 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {fmtPrice(p.amountCents, p.currency)}{' '}
                        <span className="text-xs text-neutral-500">
                          · {p.kind}
                        </span>
                      </p>
                      <p className="text-xs text-neutral-500">
                        {fmtDate(p.paidAt ?? p.createdAt)} · {p.status}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-4">Contact</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                  Phone
                </dt>
                <dd className="font-medium">{member.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                  Company
                </dt>
                <dd className="font-medium">{member.company ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                  Address
                </dt>
                <dd className="font-medium">
                  {member.address ?? '—'}
                  {member.city && <>, {member.city}</>}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                  Pincode
                </dt>
                <dd className="font-mono text-sm">{member.pincode ?? '—'}</dd>
              </div>
            </dl>
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-4">Account</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                  Membership
                </dt>
                <dd className="font-medium">
                  {subscription ? (
                    <>
                      {subscription.planName}
                      <span className="block text-xs font-normal text-neutral-500">
                        {subscription.status === 'active'
                          ? subscription.lapsed
                            ? `lapsed ${fmtDate(subscription.currentPeriodEnd)} — record a renewal payment`
                            : `paid through ${fmtDate(subscription.currentPeriodEnd)}`
                          : subscription.status}
                      </span>
                      <AdminSubscriptionControls
                        userId={member.id}
                        subscriptionId={subscription.id}
                        status={subscription.status}
                        lapsed={subscription.lapsed}
                      />
                    </>
                  ) : (
                    'None'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                  Joined
                </dt>
                <dd className="font-medium">
                  {fmtDate(member.registeredAt ?? member.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                  Last sign-in
                </dt>
                <dd className="font-medium">
                  {member.lastSignInAt ? fmtDateTime(member.lastSignInAt) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                  Terms accepted
                </dt>
                <dd className="text-xs">
                  {member.termsVersion
                    ? `${member.termsVersion} (${fmtDate(member.termsAcceptedAt)})`
                    : 'Not yet'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-4">Virtual office</h2>
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="font-heading text-lg mb-3">Internal notes</h2>
            <AdminNoteForm userId={member.id} />
            {notes.length === 0 ? (
              <p className="text-xs text-neutral-500 mt-4">No notes yet.</p>
            ) : (
              <ul className="mt-4 space-y-3 max-h-96 overflow-y-auto">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="text-sm border-l-2 border-darkBlue-200 pl-3 py-1"
                  >
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {n.authorName ?? 'unknown'} · {fmtDate(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function MemberAvatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={`${name} selfie`}
        width={96}
        height={96}
        className="w-24 h-24 rounded-full object-cover border border-neutral-200 shrink-0"
        unoptimized
      />
    )
  }
  return (
    <div className="w-24 h-24 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 shrink-0">
      <User size={36} strokeWidth={1.5} />
    </div>
  )
}
