'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  firstName: string
  fullName: string
  email: string
}

type SuccessResult =
  | {
      status: 'checked_in'
      member: { fullName: string | null; email: string }
      via: 'subscription' | 'pass'
      passDeducted?: number
    }
  | {
      status: 'already_checked_in'
      member: { fullName: string | null; email: string }
    }
  | { status: 'needs_payment' }

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; result: SuccessResult }
  | { kind: 'checking-out' }
  | { kind: 'checked-out' }
  | { kind: 'error'; message: string }

export default function MemberPhoneCheckin({
  firstName,
  fullName,
  email,
}: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  const submit = async () => {
    setState({ kind: 'submitting' })
    try {
      const res = await fetch('/api/checkin/phone-member', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        status?: string
        member?: { fullName: string | null; email: string }
        via?: 'subscription' | 'pass'
        passDeducted?: number
      }
      if (!res.ok) {
        setState({ kind: 'error', message: humanError(data.error) })
        return
      }
      setState({ kind: 'success', result: data as SuccessResult })
    } catch {
      setState({ kind: 'error', message: 'Network error. Try again.' })
    }
  }

  const checkOut = async () => {
    setState({ kind: 'checking-out' })
    try {
      const res = await fetch('/api/checkin/phone-checkout', {
        method: 'POST',
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setState({
          kind: 'error',
          message:
            data.error === 'not_checked_in'
              ? "You're not currently checked in."
              : 'Could not check you out. Try again.',
        })
        return
      }
      setState({ kind: 'checked-out' })
    } catch {
      setState({ kind: 'error', message: 'Network error. Try again.' })
    }
  }

  if (state.kind === 'checked-out') {
    return (
      <Card>
        <CheckCircle2 size={64} className="text-turquoise-500 mb-3" />
        <h2 className="font-heading text-3xl mb-1">
          Bye, {firstName || 'friend'}!
        </h2>
        <p className="text-neutral-600">
          You&apos;re checked out. See you next time.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 text-sm text-turquoise-700 hover:text-turquoise-900 underline"
        >
          Back to dashboard
        </Link>
      </Card>
    )
  }

  if (state.kind === 'success') {
    const r = state.result
    if (r.status === 'needs_payment') {
      return (
        <Card>
          <AlertCircle size={48} className="text-orange-500 mb-3" />
          <h2 className="font-heading text-2xl mb-2">No active plan or pass</h2>
          <p className="text-sm text-neutral-600 mb-5">
            Pick a pass and we&apos;ll check you in straight after.
          </p>
          <Link href="/buy">
            <Button size="lg">See pass options</Button>
          </Link>
        </Card>
      )
    }
    return (
      <Card>
        <CheckCircle2 size={64} className="text-turquoise-500 mb-3" />
        <h2 className="font-heading text-3xl mb-1">
          {r.status === 'already_checked_in'
            ? "You're already checked in"
            : `Welcome in, ${firstName}.`}
        </h2>
        <p className="text-neutral-600">
          {r.member.fullName ?? r.member.email}
        </p>
        {r.status === 'checked_in' &&
          r.via === 'pass' &&
          typeof r.passDeducted === 'number' && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-neutral-700 bg-turquoise-50 px-3 py-1.5 rounded-full">
              <Sparkles size={14} className="text-turquoise-600" />
              Day pass used · {r.passDeducted} remaining
            </p>
          )}
        {r.status === 'checked_in' && r.via === 'subscription' && (
          <p className="mt-3 text-sm text-neutral-500">
            Monthly membership · have a great day.
          </p>
        )}
        {r.status === 'already_checked_in' && (
          <Button
            size="lg"
            variant="outline"
            className="mt-5 w-full"
            onClick={checkOut}
          >
            Heading out? Check me out
          </Button>
        )}
        <Link
          href="/dashboard"
          className="mt-6 text-sm text-turquoise-700 hover:text-turquoise-900 underline"
        >
          Back to dashboard
        </Link>
      </Card>
    )
  }

  if (state.kind === 'checking-out') {
    return (
      <Card>
        <p className="text-neutral-600">Checking you out…</p>
      </Card>
    )
  }

  if (state.kind === 'error') {
    return (
      <Card>
        <AlertCircle size={48} className="text-red-500 mb-3" />
        <h2 className="font-heading text-xl mb-2">
          Couldn&apos;t check you in
        </h2>
        <p className="text-sm text-neutral-600 mb-4">{state.message}</p>
        <Button onClick={() => setState({ kind: 'idle' })}>Try again</Button>
      </Card>
    )
  }

  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-turquoise-700 font-medium mb-2">
        Check in
      </p>
      <h1 className="font-heading text-3xl md:text-4xl mb-2">
        Hey {firstName || 'there'}.
      </h1>
      <p className="text-neutral-600 mb-2">{fullName || email}</p>
      <p className="text-sm text-neutral-500 mb-6">
        Tap below and you&apos;re in.
      </p>
      <Button
        size="lg"
        className="w-full h-14 text-base"
        disabled={state.kind === 'submitting'}
        onClick={submit}
      >
        {state.kind === 'submitting' ? 'Checking you in…' : 'Check me in'}
      </Button>
    </Card>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-8 md:p-10 flex flex-col items-center text-center">
      {children}
    </div>
  )
}

function humanError(code: string | undefined): string {
  switch (code) {
    case 'not_signed_in':
      return 'Your session expired. Sign in and try again.'
    case 'pass_not_available':
      return 'No usable pass on file. Buy one and try again.'
    case 'unknown_member':
      return "We couldn't find your member account."
    default:
      return 'Something went wrong. Try again or ask the manager.'
  }
}
