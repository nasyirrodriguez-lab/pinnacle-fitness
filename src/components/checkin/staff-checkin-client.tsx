'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { ArrowLeft, CheckCircle2, AlertCircle, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StaffPerson {
  id: string
  displayName: string
  roleLabel: string
  checkedIn: boolean
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'success'; name: string }
  | { kind: 'error'; message: string }

// Kiosk staff/partner check-in: tap your name, you're in — free, no
// pass deducted. People already in the building show as checked in.
export default function StaffCheckinClient() {
  const [people, setPeople] = useState<StaffPerson[]>([])
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [isPending, startTransition] = useTransition()

  const load = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkin/staff', { cache: 'no-store' })
        const data = (await res.json().catch(() => ({}))) as {
          staff?: StaffPerson[]
          error?: string
        }
        if (!res.ok || !data.staff) {
          setStatus({
            kind: 'error',
            message:
              data.error === 'kiosk_not_paired'
                ? 'This tablet is no longer paired. Ask an admin to re-pair.'
                : 'Could not load the list. Try again.',
          })
          return
        }
        setPeople(data.staff)
        setStatus({ kind: 'ready' })
      } catch {
        setStatus({ kind: 'error', message: 'Network error. Try again.' })
      }
    })
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (status.kind !== 'success') return
    const t = window.setTimeout(() => {
      window.location.href = '/checkin'
    }, 6000)
    return () => window.clearTimeout(t)
  }, [status])

  const checkIn = (person: StaffPerson) => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkin/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: person.id }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message:
              data.error === 'already_checked_in'
                ? "You're already checked in. All good!"
                : 'Could not check you in. Ask the team for a hand.',
          })
          return
        }
        setStatus({ kind: 'success', name: person.displayName })
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
          Welcome in, {status.name.split(' ')[0]}!
        </h2>
        <p className="text-neutral-600">You&apos;re checked in for the day.</p>
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

  return (
    <div>
      <Link
        href="/checkin"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      <h1 className="font-heading text-3xl md:text-4xl mb-2">
        Staff, partners &amp; private
      </h1>
      <p className="text-neutral-600 mb-6">
        Tap your name — your day is on the house.
      </p>

      {status.kind === 'loading' ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : people.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center text-neutral-500 text-sm">
          Nobody holds a designation yet. Ask the team to set you up.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {people.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={p.checkedIn || isPending}
                onClick={() => checkIn(p)}
                className="w-full flex items-center gap-4 text-left bg-white border border-neutral-200 rounded-lg p-5 hover:border-turquoise-500 hover:shadow-sm transition disabled:opacity-60 disabled:hover:border-neutral-200 disabled:hover:shadow-none"
              >
                <span className="w-11 h-11 rounded-md bg-lime-50 text-lime-700 flex items-center justify-center shrink-0">
                  <Shield size={22} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-lg truncate">
                    {p.displayName}
                  </span>
                  {p.checkedIn && (
                    <span className="block text-sm text-neutral-500">
                      Already in
                    </span>
                  )}
                </span>
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
