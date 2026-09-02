'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { isOwner } from '@/lib/auth/roles'
import {
  reconcilePendingWamBatch,
  type ReconcileBatchResult,
} from '@/lib/payments/reconcile'

// =====================================================================
// Admin button wrapper around the shared Wam reconcile core (see
// src/lib/payments/reconcile.ts — the cron route uses the same core).
// Batches of 10 per click so we never exceed the function timeout; the
// UI invites another click while remainingAfter > 0.
// =====================================================================

export type ReconcileResult = ReconcileBatchResult

async function assertAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || !isOwner((profile as { role?: string }).role)) {
    return { ok: false, error: 'Owners only' }
  }
  return { ok: true }
}

export async function reconcilePendingWamPayments(): Promise<ReconcileResult> {
  const auth = await assertAdmin()
  if (!auth.ok) {
    return {
      ok: false,
      error: auth.error,
      scanned: 0,
      wamVerified: 0,
      failed: 0,
      stillPending: 0,
      remainingAfter: 0,
      perPayment: [],
    }
  }

  const result = await reconcilePendingWamBatch(10)

  revalidatePath('/admin/payments')
  revalidatePath('/admin')

  return result
}
