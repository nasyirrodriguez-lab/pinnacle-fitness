'use client'

import { useReceptionStatus } from './reception-status-context'
import {
  getReason,
  formatCountdown,
  pickOverdueMessage,
} from '@/lib/checkin/reception-status'

// =====================================================================
// Visitor-facing status ribbon shown above the /checkin content while the
// receptionist is away. Member / Guest / QR self check-in stays fully
// usable below it. At zero it flips to a light-hearted "running late" line
// rather than vanishing.
//
// The presentation lives in ReceptionStatusBannerView (pure, prop-driven,
// Storybook-able); the default export wires it to the live context.
// =====================================================================

function formatReturnClock(returnAtIso: string | null): string {
  if (!returnAtIso) return ''
  const d = new Date(returnAtIso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', {
    timeZone: 'America/Port_of_Spain',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export interface ReceptionStatusBannerViewProps {
  reasonId: string | null
  awaySinceMs: number | null
  returnAtIso: string | null
  secondsLeft: number
  isOverdue: boolean
  /** Optional override for the headline (falls back to the reason message). */
  message?: string | null
}

export function ReceptionStatusBannerView({
  reasonId,
  awaySinceMs,
  returnAtIso,
  secondsLeft,
  isOverdue,
  message,
}: ReceptionStatusBannerViewProps) {
  const reason = getReason(reasonId)
  const Icon = reason.icon
  const headline = isOverdue
    ? pickOverdueMessage(awaySinceMs ?? 0)
    : (message ?? reason.message)

  return (
    <div
      className={
        isOverdue
          ? 'w-full border-b border-orange-300 bg-orange-50'
          : 'w-full border-b border-darkOrange-200 bg-darkOrange-50'
      }
      role="status"
      aria-live="polite"
    >
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 md:py-7">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-4 md:gap-5 flex-1 min-w-0">
            <span
              className={
                isOverdue
                  ? 'w-16 h-16 md:w-20 md:h-20 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center shrink-0'
                  : 'w-16 h-16 md:w-20 md:h-20 rounded-full bg-darkOrange-100 text-darkOrange-700 flex items-center justify-center shrink-0'
              }
            >
              <Icon className="w-8 h-8 md:w-10 md:h-10" />
            </span>
            <div className="min-w-0">
              <p
                className={
                  isOverdue
                    ? 'text-sm md:text-base uppercase tracking-widest font-bold text-orange-700 mb-1'
                    : 'text-sm md:text-base uppercase tracking-widest font-bold text-darkOrange-700 mb-1'
                }
              >
                Reception · Be Right Back
              </p>
              <p className="font-heading font-bold text-3xl md:text-5xl leading-[1.05] text-neutral-900">
                {headline}
              </p>
              {returnAtIso && (
                <p className="text-base md:text-lg text-neutral-600 mt-1.5">
                  Expected back around {formatReturnClock(returnAtIso)}
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 self-start sm:self-auto">
            {isOverdue ? (
              <div className="rounded-full bg-orange-100 px-6 py-3 text-lg md:text-xl font-bold text-orange-800">
                Back any minute
              </div>
            ) : (
              <div className="rounded-xl bg-white/70 border border-darkOrange-200 px-6 md:px-8 py-3 md:py-4 text-center min-w-[150px] md:min-w-[180px]">
                <p className="text-xs md:text-sm uppercase tracking-widest font-bold text-darkOrange-700">
                  Back in
                </p>
                <p className="font-heading font-bold text-4xl md:text-6xl tabular-nums leading-none text-neutral-900 mt-1">
                  {formatCountdown(secondsLeft)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ReceptionStatusBanner() {
  const { status, isAway, secondsLeft, isOverdue } = useReceptionStatus()
  if (!isAway || !status) return null

  return (
    <ReceptionStatusBannerView
      reasonId={status.reason_id}
      awaySinceMs={
        status.away_since ? new Date(status.away_since).getTime() : null
      }
      returnAtIso={status.return_at}
      secondsLeft={secondsLeft}
      isOverdue={isOverdue}
      message={status.message}
    />
  )
}
