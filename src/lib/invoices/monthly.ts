import type { SupabaseClient } from '@supabase/supabase-js'
import { effectivePrice } from '@/lib/pricing/effective'
import { createInvoice, type InvoiceLineItem } from '@/lib/invoices/create'

// Monthly auto-invoicing: everyone currently renting an office
// (designation office_rental) or holding a virtual-office membership
// gets an official invoice for the month — plan price plus their active
// add-ons — with a Wam pay link. Idempotent per member per month.

export interface MonthlyInvoicingResult {
  candidates: number
  created: number
  skippedExisting: number
  errors: string[]
}

function currentPeriodLabel(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Port_of_Spain',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

export async function invoiceMonthlyRenters(
  admin: SupabaseClient
): Promise<MonthlyInvoicingResult> {
  const periodLabel = currentPeriodLabel()
  const result: MonthlyInvoicingResult = {
    candidates: 0,
    created: 0,
    skippedExisting: 0,
    errors: [],
  }

  const { data: subs, error } = await admin
    .from('subscriptions')
    .select(
      'user_id, plan_id, status, plans(name, price_cents, discounted_price_cents, discount_expires_at), profiles!subscriptions_user_id_fkey(designation, archived)'
    )
    .in('status', ['active', 'past_due'])
  if (error) {
    result.errors.push(`query failed: ${error.message}`)
    return result
  }

  type Row = {
    user_id: string
    plan_id: string
    plans:
      | {
          name?: string
          price_cents?: number
          discounted_price_cents?: number | null
          discount_expires_at?: string | null
        }
      | {
          name?: string
          price_cents?: number
          discounted_price_cents?: number | null
          discount_expires_at?: string | null
        }[]
      | null
    profiles:
      | { designation: string | null; archived: boolean }
      | { designation: string | null; archived: boolean }[]
      | null
  }

  for (const raw of (subs as Row[] | null) ?? []) {
    const plan = Array.isArray(raw.plans) ? (raw.plans[0] ?? null) : raw.plans
    const profile = Array.isArray(raw.profiles)
      ? (raw.profiles[0] ?? null)
      : raw.profiles
    if (!plan || profile?.archived) continue

    const isVirtualOffice = raw.plan_id === 'virtual-office-monthly'
    const isOfficeRental = profile?.designation === 'office_rental'
    if (!isVirtualOffice && !isOfficeRental) continue
    result.candidates++

    // One invoice per member per month.
    const { data: existing } = await admin
      .from('invoices')
      .select('id')
      .eq('user_id', raw.user_id)
      .eq('period_label', periodLabel)
      .limit(1)
    if (existing && existing.length > 0) {
      result.skippedExisting++
      continue
    }

    const planName = plan.name ?? raw.plan_id
    const planCents = effectivePrice({
      price_cents: plan.price_cents ?? 0,
      discounted_price_cents: plan.discounted_price_cents ?? null,
      discount_expires_at: plan.discount_expires_at ?? null,
    }).effectiveCents
    const lineItems: InvoiceLineItem[] = [
      { label: `${planName} — ${periodLabel}`, amountCents: planCents },
    ]

    const { data: addons } = await admin
      .from('member_addons')
      .select('label, amount_cents')
      .eq('user_id', raw.user_id)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    for (const addon of (addons as
      | { label: string; amount_cents: number }[]
      | null) ?? []) {
      lineItems.push({ label: addon.label, amountCents: addon.amount_cents })
    }

    const dueAt = new Date()
    dueAt.setDate(dueAt.getDate() + 7)

    const created = await createInvoice(admin, {
      userId: raw.user_id,
      kind: isVirtualOffice ? 'virtual_office' : 'office_rental',
      lineItems,
      periodLabel,
      dueAt: dueAt.toISOString(),
      planId: raw.plan_id,
      createdBy: null,
    })
    if (created.ok) {
      result.created++
    } else {
      result.errors.push(`${raw.user_id}: ${created.error}`)
    }
  }

  return result
}
