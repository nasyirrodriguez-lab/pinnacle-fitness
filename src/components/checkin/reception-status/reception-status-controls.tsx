'use client'

import { useEffect, useState } from 'react'
import { MoreVertical, Check, LogIn } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  REASONS,
  DURATIONS,
  DEFAULT_DURATION_MINUTES,
  getReason,
} from '@/lib/checkin/reception-status'
import {
  useReceptionStatus,
  useReceptionStatusActions,
} from './reception-status-context'

// =====================================================================
// Receptionist controls. A discreet options button (top-right of the
// /checkin header) opens a Sheet to set "Be Right Back": pick a reason,
// pick a duration, confirm. When already away it also offers "I'm back".
// Anyone on the paired kiosk can use it — no extra auth.
// =====================================================================

export default function ReceptionStatusControls() {
  const { status, isAway } = useReceptionStatus()
  const { setAway, setBack } = useReceptionStatusActions()

  const [open, setOpen] = useState(false)
  const [reasonId, setReasonId] = useState<string>(REASONS[0].id)
  const [minutes, setMinutes] = useState<number>(DEFAULT_DURATION_MINUTES)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-select the active reason/duration when opening during a break.
  useEffect(() => {
    if (open && isAway && status) {
      setReasonId(status.reason_id ?? REASONS[0].id)
    }
  }, [open, isAway, status])

  const projectedReturn = new Date(
    Date.now() + minutes * 60_000
  ).toLocaleTimeString('en-US', {
    timeZone: 'America/Port_of_Spain',
    hour: 'numeric',
    minute: '2-digit',
  })

  const handleStart = async () => {
    setPending(true)
    setError(null)
    try {
      await setAway(reasonId, minutes)
      setOpen(false)
    } catch {
      setError('Could not update status. Try again.')
    } finally {
      setPending(false)
    }
  }

  const handleReturn = async () => {
    setPending(true)
    setError(null)
    try {
      await setBack()
      setOpen(false)
    } catch {
      setError('Could not update status. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reception options"
        className="inline-flex items-center justify-center w-10 h-10 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition"
      >
        <MoreVertical size={20} />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-heading text-2xl">
              {isAway ? 'Update front desk status' : 'Step away from the desk'}
            </SheetTitle>
            <SheetDescription>
              Visitors can still check themselves in while you&apos;re away.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-7">
            <section>
              <p className="text-xs uppercase tracking-wide font-medium text-neutral-500 mb-3">
                1 · Why are you stepping away?
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {REASONS.map((reason) => {
                  const Icon = reason.icon
                  const selected = reason.id === reasonId
                  return (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => setReasonId(reason.id)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg border-2 p-3 text-left transition',
                        selected
                          ? 'border-darkOrange-500 bg-darkOrange-50'
                          : 'border-neutral-200 hover:border-darkOrange-300'
                      )}
                    >
                      <Icon
                        size={18}
                        className={
                          selected ? 'text-darkOrange-700' : 'text-neutral-500'
                        }
                      />
                      <span className="text-sm font-medium leading-tight">
                        {reason.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section>
              <p className="text-xs uppercase tracking-wide font-medium text-neutral-500 mb-3">
                2 · For how long?
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {DURATIONS.map((d) => {
                  const selected = d.minutes === minutes
                  return (
                    <button
                      key={d.minutes}
                      type="button"
                      onClick={() => setMinutes(d.minutes)}
                      className={cn(
                        'rounded-lg border-2 py-3 text-sm font-semibold transition',
                        selected
                          ? 'border-lime-500 bg-lime-500 text-neutral-900'
                          : 'border-neutral-200 hover:border-lime-400'
                      )}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-sm text-neutral-500 mt-3">
                Back around{' '}
                <span className="font-semibold text-neutral-900">
                  {projectedReturn}
                </span>
              </p>
            </section>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>

          <SheetFooter>
            <Button
              colorScheme="darkOrange"
              size="lg"
              className="w-full h-12 text-base"
              disabled={pending}
              onClick={handleStart}
            >
              <Check size={18} />
              {isAway ? 'Update status' : `Set "${getReason(reasonId).label}"`}
            </Button>
            {isAway && (
              <Button
                variant="outline"
                size="lg"
                className="w-full h-12 text-base"
                disabled={pending}
                onClick={handleReturn}
              >
                <LogIn size={18} />
                I&apos;m back at the desk
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
