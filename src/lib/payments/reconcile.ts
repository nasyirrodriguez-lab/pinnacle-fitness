import { createAdminClient } from '@/utils/supabase/admin'
import { getWam } from '@/lib/wam/client'

// =====================================================================
// Shared Wam reconcile core. Called from two places:
//   - the admin "Check pending" button (server action, admin-gated)
//   - the cron route (every 10 min, CRON_SECRET-gated)
//
// Reconcile NEVER marks a payment paid. Only two things confirm a Wam
// payment: the payment_intent.succeeded webhook, or an admin explicitly
// verifying it against Wam. Polling Wam's status API has produced false
// positives (click-throughs reported alongside genuinely settling
// payments), so here it is used only to:
//   - mark explicit failures (failed / canceled / expired) as failed
//   - sweep pre-payment intents older than a day to failed (abandoned)
//   - stamp payments Wam reports as succeeded, so the admin payments
//     page can surface them for one-click verification
// =====================================================================

interface PaymentRow {
  id: string
  user_id: string | null
  wam_payment_id: string | null
  kind: string
  metadata: Record<string, unknown> | null
  created_at: string | null
}

export type ReconcileOutcome =
  | 'wam_verified'
  | 'failed'
  | 'still_pending'
  | 'missing_wam_id'
  | 'wam_error'

export interface ReconcilePerPayment {
  paymentId: string
  wamPaymentId: string | null
  outcome: ReconcileOutcome
  note?: string
}

export interface ReconcileBatchResult {
  ok: boolean
  error?: string
  scanned: number
  wamVerified: number
  failed: number
  stillPending: number
  remainingAfter: number
  perPayment: ReconcilePerPayment[]
}

const WAM_CALL_TIMEOUT_MS = 6000

export async function reconcilePendingWamBatch(
  batchSize = 10
): Promise<ReconcileBatchResult> {
  const admin = createAdminClient()
  const wam = getWam()

  const { data: rawRows, error } = await admin
    .from('payments')
    .select('id, user_id, wam_payment_id, kind, metadata, created_at')
    .eq('status', 'pending')
    .eq('payment_method', 'wam_online')
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (error) {
    return {
      ok: false,
      error: error.message,
      scanned: 0,
      wamVerified: 0,
      failed: 0,
      stillPending: 0,
      remainingAfter: 0,
      perPayment: [],
    }
  }

  const rows = (rawRows ?? []) as PaymentRow[]

  const processOne = async (row: PaymentRow): Promise<ReconcilePerPayment> => {
    if (!row.wam_payment_id) {
      return {
        paymentId: row.id,
        wamPaymentId: null,
        outcome: 'missing_wam_id',
      }
    }

    let wamStatus
    try {
      wamStatus = (await Promise.race([
        wam.getPaymentIntentStatus(row.wam_payment_id),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('wam call timed out')),
            WAM_CALL_TIMEOUT_MS
          )
        ),
      ])) as Awaited<ReturnType<typeof wam.getPaymentIntentStatus>>
    } catch (err) {
      console.error(
        '[reconcile] getPaymentIntentStatus failed for',
        row.wam_payment_id,
        err
      )
      return {
        paymentId: row.id,
        wamPaymentId: row.wam_payment_id,
        outcome: 'wam_error',
        note: err instanceof Error ? err.message : 'unknown error',
      }
    }

    const isFailure =
      wamStatus.status === 'failed' ||
      wamStatus.status === 'canceled' ||
      wamStatus.status === 'expired'

    if (isFailure) {
      await admin
        .from('payments')
        .update({
          status: 'failed',
          failure_reason: `reconciled: wam ${wamStatus.status}`,
        })
        .eq('id', row.id)
        .eq('status', 'pending')
      return {
        paymentId: row.id,
        wamPaymentId: row.wam_payment_id,
        outcome: 'failed',
        note: wamStatus.status,
      }
    }

    // Wam's status API says succeeded — but polling has produced false
    // positives, so this is evidence, not confirmation. Stamp it so the
    // admin payments page can surface the row for explicit verification;
    // the webhook remains the only automatic confirmer.
    if (wamStatus.status === 'succeeded') {
      const metadata = row.metadata ?? {}
      if (!metadata.wamReportsPaidAt) {
        await admin
          .from('payments')
          .update({
            metadata: {
              ...metadata,
              wamReportsPaidAt:
                wamStatus.completedAt ?? new Date().toISOString(),
            },
          })
          .eq('id', row.id)
          .eq('status', 'pending')
      }
      return {
        paymentId: row.id,
        wamPaymentId: row.wam_payment_id,
        outcome: 'wam_verified',
        note: 'wam reports succeeded — awaiting webhook or admin verification',
      }
    }

    // Mid-checkout (created / requires_payment_method) or processing.
    // Abandoned attempts (still pre-payment after a day) get swept to
    // failed so they stop clogging the pending queue and holding
    // discount-code uses.
    const preAuth =
      wamStatus.status === 'created' ||
      wamStatus.status === 'requires_payment_method'
    if (preAuth && row.created_at) {
      const ageMs = Date.now() - new Date(row.created_at).getTime()
      if (ageMs > 24 * 60 * 60 * 1000) {
        await admin
          .from('payments')
          .update({
            status: 'failed',
            failure_reason: `reconciled: abandoned (wam ${wamStatus.status} after 24h)`,
          })
          .eq('id', row.id)
          .eq('status', 'pending')
        return {
          paymentId: row.id,
          wamPaymentId: row.wam_payment_id,
          outcome: 'failed',
          note: `abandoned: ${wamStatus.status}`,
        }
      }
    }
    return {
      paymentId: row.id,
      wamPaymentId: row.wam_payment_id,
      outcome: 'still_pending',
      note: wamStatus.status,
    }
  }

  const perPayment = await Promise.all(rows.map(processOne))
  const wamVerified = perPayment.filter(
    (p) => p.outcome === 'wam_verified'
  ).length
  const failed = perPayment.filter((p) => p.outcome === 'failed').length
  const stillPending = perPayment.filter(
    (p) => p.outcome === 'still_pending'
  ).length

  const { count: remainingAfter } = await admin
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('payment_method', 'wam_online')

  return {
    ok: true,
    scanned: rows.length,
    wamVerified,
    failed,
    stillPending,
    remainingAfter: remainingAfter ?? 0,
    perPayment,
  }
}
