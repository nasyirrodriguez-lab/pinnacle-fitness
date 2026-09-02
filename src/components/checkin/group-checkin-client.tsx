'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { ArrowLeft, CheckCircle2, AlertCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface GroupEntry {
  ownerId: string
  ownerName: string
  productName: string
  groupSize: number
  todayCount: number
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'naming'; group: GroupEntry }
  | { kind: 'success'; ownerName: string; checkedIn: number; groupSize: number }
  | { kind: 'error'; message: string }

// Kiosk group membership check-in: tap the member whose group plan or
// pass you're on, type your name, you're in. The entry disappears once
// today's headcount reaches the group size.
export default function GroupCheckinClient() {
  const [groups, setGroups] = useState<GroupEntry[]>([])
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [guestName, setGuestName] = useState('')
  const [isPending, startTransition] = useTransition()

  const load = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkin/group', { cache: 'no-store' })
        const data = (await res.json().catch(() => ({}))) as {
          groups?: GroupEntry[]
          error?: string
        }
        if (!res.ok || !data.groups) {
          setStatus({
            kind: 'error',
            message:
              data.error === 'kiosk_not_paired'
                ? 'This tablet is no longer paired. Ask an admin to re-pair.'
                : 'Could not load group memberships. Try again.',
          })
          return
        }
        setGroups(data.groups)
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
      setGuestName('')
      setStatus({ kind: 'loading' })
      load()
    }, 4000)
    return () => window.clearTimeout(t)
  }, [status])

  const checkIn = (group: GroupEntry) => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkin/group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerId: group.ownerId,
            guestName: guestName.trim(),
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          checkedIn?: number
          groupSize?: number
        }
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message:
              data.error === 'group_full'
                ? 'This group is fully checked in for today.'
                : 'Could not check you in. Ask the team for a hand.',
          })
          return
        }
        setStatus({
          kind: 'success',
          ownerName: group.ownerName,
          checkedIn: data.checkedIn ?? 1,
          groupSize: data.groupSize ?? group.groupSize,
        })
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
          Welcome, {guestName.trim().split(' ')[0] || 'friend'}!
        </h2>
        <p className="text-neutral-600">
          Checked in with {status.ownerName.split(' ')[0]}&apos;s group —{' '}
          {status.checkedIn} of {status.groupSize} in today.
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

  if (status.kind === 'naming') {
    const g = status.group
    return (
      <Card>
        <Users size={44} className="text-turquoise-600 mb-3" />
        <h2 className="font-heading text-2xl mb-1">
          {g.ownerName.split(' ')[0]}&apos;s group
        </h2>
        <p className="text-sm text-neutral-600 mb-5">
          {g.productName} · {g.todayCount} of {g.groupSize} in today. Type your
          name so we know who&apos;s here.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (guestName.trim()) checkIn(g)
          }}
          className="w-full max-w-sm space-y-3"
        >
          <Input
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            disabled={isPending}
            maxLength={120}
            autoFocus
            className="h-12 text-center"
          />
          <div className="flex gap-3 justify-center">
            <Button
              type="submit"
              size="lg"
              disabled={isPending || !guestName.trim()}
            >
              {isPending ? 'Checking in…' : 'Check me in'}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setGuestName('')
                setStatus({ kind: 'ready' })
              }}
            >
              Back
            </Button>
          </div>
        </form>
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

      <h1 className="font-heading text-3xl md:text-4xl mb-2">Group check-in</h1>
      <p className="text-neutral-600 mb-6">
        On a team&apos;s group plan or pass? Tap the member who holds it.
      </p>

      {status.kind === 'loading' ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center text-neutral-500 text-sm">
          No group memberships available right now — either none are active or
          every group is fully in for today.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((g) => (
            <li key={g.ownerId}>
              <button
                type="button"
                onClick={() => setStatus({ kind: 'naming', group: g })}
                className="w-full flex items-center gap-4 text-left bg-white border border-neutral-200 rounded-lg p-5 hover:border-turquoise-500 hover:shadow-sm transition"
              >
                <span className="w-11 h-11 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
                  <Users size={22} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-lg truncate">
                    {g.ownerName}
                  </span>
                  <span className="block text-sm text-neutral-500">
                    {g.productName} · {g.todayCount} of {g.groupSize} in today
                  </span>
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
