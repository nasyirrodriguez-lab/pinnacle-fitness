'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AiFillCheckCircle } from 'react-icons/ai'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  paymentId: string
}

type State =
  | { kind: 'polling' }
  | {
      kind: 'succeeded'
      amountCents: number
      currency: string
      paymentKind: string
    }
  | { kind: 'failed'; status: string }
  | { kind: 'not-found' }

export default function CheckoutStatusPoller({ paymentId }: Props) {
  const [state, setState] = useState<State>({ kind: 'polling' })

  useEffect(() => {
    let cancelled = false
    let attempts = 0

    const poll = async () => {
      attempts++
      try {
        const res = await fetch(
          `/api/payments/status?paymentId=${encodeURIComponent(paymentId)}`,
          { cache: 'no-store' }
        )
        if (cancelled) return
        if (res.status === 404) {
          setState({ kind: 'not-found' })
          return
        }
        if (!res.ok) throw new Error('status')
        const body = (await res.json()) as {
          status: string
          isTerminal: boolean
          amountCents: number
          currency: string
          kind: string
        }
        if (body.isTerminal) {
          if (body.status === 'succeeded') {
            setState({
              kind: 'succeeded',
              amountCents: body.amountCents,
              currency: body.currency,
              paymentKind: body.kind,
            })
          } else {
            setState({ kind: 'failed', status: body.status })
          }
          return
        }
        // Stop polling after ~90s — Wam's confirmation webhook usually
        // lands well within that.
        if (attempts >= 45) {
          setState({ kind: 'failed', status: 'timeout' })
          return
        }
        setTimeout(poll, 2000)
      } catch {
        if (!cancelled && attempts < 45) setTimeout(poll, 4000)
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [paymentId])

  if (state.kind === 'polling') {
    return (
      <div className="text-center py-8">
        <div className="inline-block w-8 h-8 border-2 border-turquoise-200 border-t-turquoise-500 rounded-full animate-spin mb-4" />
        <p className="text-neutral-600">Confirming your payment…</p>
      </div>
    )
  }

  if (state.kind === 'succeeded') {
    const formatted = `${state.currency} $${(state.amountCents / 100).toFixed(2)}`
    const isBooking = state.paymentKind === 'booking'
    return (
      <div className="text-center">
        <AiFillCheckCircle className="mx-auto w-14 h-14 text-turquoise-500 mb-3" />
        <h1 className="font-heading text-2xl mb-2">
          {isBooking ? 'Booking confirmed' : 'Payment confirmed'}
        </h1>
        <p className="text-neutral-600 mb-6">
          You paid {formatted}.{' '}
          {isBooking
            ? 'Your room is reserved. Find the details on your dashboard.'
            : "We've added your pass to your account — it's ready to use."}
        </p>
        <Link href="/dashboard">
          <Button>Go to dashboard</Button>
        </Link>
      </div>
    )
  }

  if (state.kind === 'not-found') {
    return (
      <div className="text-center">
        <AlertTriangle className="mx-auto w-12 h-12 text-orange-500 mb-3" />
        <h1 className="font-heading text-2xl mb-2">Payment not found</h1>
        <p className="text-neutral-600 mb-6">
          We couldn&apos;t find that payment. If you were charged, email{' '}
          <a
            href="mailto:hello@pinnaclefitness.app"
            className="text-turquoise-700 underline"
          >
            hello@pinnaclefitness.app
          </a>
          .
        </p>
        <Link href="/dashboard">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    )
  }

  const isTimeout = state.status === 'timeout'
  return (
    <div className="text-center">
      <AlertTriangle className="mx-auto w-12 h-12 text-orange-500 mb-3" />
      <h1 className="font-heading text-2xl mb-2">
        {isTimeout ? 'Still processing' : 'Payment didn’t complete'}
      </h1>
      <p className="text-neutral-600 mb-6">
        {isTimeout
          ? 'Wam is still confirming your payment. Your purchase activates automatically the moment it confirms — check your dashboard in a few minutes. If it still hasn’t appeared, email hello@pinnaclefitness.app.'
          : `Status: ${state.status}. If you were charged, contact `}
        {!isTimeout && (
          <a
            href="mailto:hello@pinnaclefitness.app"
            className="text-turquoise-700 underline"
          >
            hello@pinnaclefitness.app
          </a>
        )}
        {!isTimeout && '.'}
      </p>
      <Link href="/dashboard">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  )
}
