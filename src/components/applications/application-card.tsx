'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  approveApplicationAction,
  saveApplicationNotes,
  setApplicationStatus,
  deleteApplication,
} from '@/app/admin/applications/actions'
import { fmtAstDate } from '@/lib/time/ast'

export interface ApplicationView {
  id: string
  fullName: string
  email: string
  phone: string | null
  experienceBracket: string | null
  trainingNow: string | null
  goal: string | null
  heardFrom: string | null
  referredBy: string | null
  planInterest: string | null
  status: string
  coachNotes: string | null
  createdAt: string
  invitedAt: string | null
  inviteExpiresAt: string | null
  paid: boolean
}

export interface PlanOption {
  id: string
  name: string
  priceCents: number
}

const BRACKET: Record<string, string> = {
  under_6m: 'Under 6 months',
  '6_24m': '6–24 months',
  '2y_plus': '2+ years',
}

export default function ApplicationCard({
  app,
  plans,
}: {
  app: ApplicationView
  plans: PlanOption[]
}) {
  const router = useRouter()
  const [notes, setNotes] = useState(app.coachNotes ?? '')
  const [planId, setPlanId] = useState(app.planInterest ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) {
        setError(r.error ?? 'Something went wrong')
        return
      }
      router.refresh()
    })
  }

  const open = !['approved', 'invited', 'declined', 'screened_out'].includes(
    app.status
  )

  return (
    <li className="rounded-card bg-card border border-border p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-heading text-lg">{app.fullName}</p>
          <p className="text-sm text-muted-foreground">
            <a href={`mailto:${app.email}`} className="hover:underline">
              {app.email}
            </a>
            {app.phone && (
              <>
                {' '}
                ·{' '}
                <a href={`tel:${app.phone}`} className="hover:underline">
                  {app.phone}
                </a>
              </>
            )}
            {' · '}applied {fmtAstDate(app.createdAt)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {app.experienceBracket && (
            <span
              className={
                app.experienceBracket === 'under_6m'
                  ? 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-900'
                  : 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-turquoise-100 text-turquoise-900'
              }
            >
              {BRACKET[app.experienceBracket] ?? app.experienceBracket}
            </span>
          )}
          {app.referredBy && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary text-foreground">
              Referred by {app.referredBy}
            </span>
          )}
          {app.status === 'invited' && app.inviteExpiresAt && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-900">
              {app.paid
                ? 'Paid'
                : `Pay link until ${fmtAstDate(app.inviteExpiresAt)}`}
            </span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mt-4">
        {app.trainingNow && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Training now
            </dt>
            <dd className="whitespace-pre-line">{app.trainingNow}</dd>
          </div>
        )}
        {app.goal && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Working toward
            </dt>
            <dd className="whitespace-pre-line">{app.goal}</dd>
          </div>
        )}
        {app.heardFrom && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Heard about us
            </dt>
            <dd>{app.heardFrom}</dd>
          </div>
        )}
        {app.planInterest && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Plan interest
            </dt>
            <dd>
              {plans.find((p) => p.id === app.planInterest)?.name ??
                app.planInterest}
            </dd>
          </div>
        )}
      </dl>

      {open && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
              Coach notes (from the intro)
            </label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (app.coachNotes ?? '')) {
                  run(() =>
                    saveApplicationNotes({ applicationId: app.id, notes })
                  )
                }
              }}
              placeholder="Solid base, wants strength. Good fit."
              maxLength={2000}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="h-10 rounded-full border border-border bg-background px-4 text-sm"
            >
              <option value="">Let them pick a plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · TT${(p.priceCents / 100).toFixed(0)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              disabled={isPending}
              onClick={() =>
                run(() =>
                  approveApplicationAction({
                    applicationId: app.id,
                    planId: planId || null,
                  })
                )
              }
            >
              {isPending ? 'Working…' : 'Approve + send pay link'}
            </Button>
            {app.status !== 'intro_booked' && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  run(() =>
                    setApplicationStatus({
                      applicationId: app.id,
                      status: 'intro_booked',
                    })
                  )
                }
              >
                Intro booked
              </Button>
            )}
            {app.status !== 'waitlisted' && (
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() =>
                  run(() =>
                    setApplicationStatus({
                      applicationId: app.id,
                      status: 'waitlisted',
                    })
                  )
                }
              >
                Waitlist
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                run(() =>
                  setApplicationStatus({
                    applicationId: app.id,
                    status: 'declined',
                  })
                )
              }
            >
              Decline
            </Button>
          </div>
        </div>
      )}

      {!open && app.coachNotes && (
        <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line">
          {app.coachNotes}
        </p>
      )}
      {(app.status === 'declined' || app.status === 'screened_out') && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            run(() => deleteApplication({ applicationId: app.id }))
          }
          className="mt-3 text-xs text-muted-foreground underline"
        >
          Remove
        </button>
      )}
      {error && <p className="text-sm text-destructive mt-3">{error}</p>}
    </li>
  )
}
