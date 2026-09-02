'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  LogOut,
  UserCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtAstTime } from '@/lib/time/ast'

interface OpenVisit {
  id: string
  kind: string
  displayName: string
  checkedInAt: string
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'confirming'; visit: OpenVisit }
  | { kind: 'success'; name: string }
  | { kind: 'error'; message: string }

// Kiosk check-out: list everyone currently in the building, tap your
// name, confirm, done. Auto-resets so the tablet is ready for the next
// person.
export default function CheckoutClient() {
  const [visits, setVisits] = useState<OpenVisit[]>([])
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [isPending, startTransition] = useTransition()

  const load = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkin/checkout', {
          cache: 'no-store',
        })
        const data = (await res.json().catch(() => ({}))) as {
          visits?: OpenVisit[]
          error?: string
        }
        if (!res.ok || !data.visits) {
          setStatus({
            kind: 'error',
            message:
              data.error === 'kiosk_not_paired'
                ? 'This tablet is no longer paired. Ask an admin to re-pair.'
                : 'Could not load the check-in list. Try again.',
          })
          return
        }
        setVisits(data.visits)
        setStatus({ kind: 'ready' })
      } catch {
        setStatus({ kind: 'error', message: 'Network error. Try again.' })
      }
    })
  }

  // Initial load, wrapped in the transition to satisfy the
  // setState-in-effect lint rule.
  useEffect(() => {
    load()
  }, [])

  // Auto-reset to the kiosk home 8s after a successful check-out.
  useEffect(() => {
    if (status.kind !== 'success') return
    const t = window.setTimeout(() => {
      window.location.href = '/checkin'
    }, 8000)
    return () => window.clearTimeout(t)
  }, [status])

  const checkOut = (visit: OpenVisit) => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkin/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitId: visit.id }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message:
              data.error === 'already_checked_out'
                ? 'Looks like you were already checked out. All good!'
                : 'Could not check you out. Try again or ask the team.',
          })
          return
        }
        setStatus({ kind: 'success', name: visit.displayName })
      } catch {
        setStatus({ kind: 'error', message: 'Network error. Try again.' })
      }
    })
  }

  if (status.kind === 'success') {
    return (
      <Card>
        <CheckCircle2 size={56} className="text-turquoise-500 mb-3" />
        <h2 className="font-heading text-3xl mb-1">
          Bye, {status.name.split(' ')[0]}!
        </h2>
        <p className="text-neutral-600">
          You&apos;re checked out. See you next time.
        </p>
      </Card>
    )
  }

  if (status.kind === 'error') {
    return (
      <Card>
        <AlertCircle size={48} className="text-red-500 mb-3" />
        <h2 className="font-heading text-xl mb-2">Something went wrong</h2>
        <p className="text-sm text-neutral-600 mb-4">{status.message}</p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setStatus({ kind: 'loading' })
              load()
            }}
          >
            Try again
          </Button>
          <Link href="/checkin">
            <Button variant="ghost">Back to check-in</Button>
          </Link>
        </div>
      </Card>
    )
  }

  if (status.kind === 'confirming') {
    const v = status.visit
    return (
      <Card>
        <LogOut size={44} className="text-turquoise-600 mb-3" />
        <h2 className="font-heading text-2xl mb-1">
          Check out {v.displayName.split(' ')[0]}?
        </h2>
        <p className="text-sm text-neutral-600 mb-5">
          Checked in at {fmtAstTime(v.checkedInAt)}.
        </p>
        <div className="flex gap-3">
          <Button size="lg" onClick={() => checkOut(v)} disabled={isPending}>
            {isPending ? 'Checking out…' : "Yes, that's me — check out"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => setStatus({ kind: 'ready' })}
            disabled={isPending}
          >
            Back
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div>
      <Link
        href="/checkin"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      <h1 className="font-heading text-3xl md:text-4xl mb-2">Heading out?</h1>
      <p className="text-neutral-600 mb-6">Tap your name to check out.</p>

      {status.kind === 'loading' ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : visits.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center text-neutral-500 text-sm">
          Nobody is currently checked in.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {visits.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setStatus({ kind: 'confirming', visit: v })}
                className="w-full flex items-center gap-4 text-left bg-white border border-neutral-200 rounded-lg p-5 hover:border-turquoise-500 hover:shadow-sm transition"
              >
                <span className="w-11 h-11 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
                  <UserCircle size={22} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-lg truncate">
                    {v.displayName}
                  </span>
                  <span className="block text-sm text-neutral-500">
                    In since {fmtAstTime(v.checkedInAt)}
                    {v.kind !== 'member' && ' · guest'}
                  </span>
                </span>
                <LogOut size={18} className="text-neutral-400 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-10 flex flex-col items-center text-center">
      {children}
    </div>
  )
}
