'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  planId: string
  priceLabel: string
  fullWidth?: boolean
}

export default function SubscribeButton({
  planId,
  priceLabel,
  fullWidth,
}: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [code, setCode] = useState('')
  const [reserved, setReserved] = useState(false)

  const onClick = async (payAtDesk = false) => {
    setError(null)
    setPending(true)
    try {
      const res = await fetch('/api/checkout/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          ...(code.trim() ? { discountCode: code.trim() } : {}),
          ...(payAtDesk ? { payAtDesk: true } : {}),
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        checkoutUrl?: string
        payAtDesk?: boolean
        error?: string
      }
      if (!res.ok || (!body.checkoutUrl && !body.payAtDesk)) {
        throw new Error(body.error ?? 'Could not start checkout')
      }
      if (body.payAtDesk) {
        setReserved(true)
        setPending(false)
        return
      }
      window.location.href = body.checkoutUrl as string
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed')
      setPending(false)
    }
  }

  if (reserved) {
    return (
      <div
        className={`bg-lime-50 border border-lime-200 rounded-md p-3 text-sm text-lime-900 ${fullWidth ? 'w-full' : ''}`}
      >
        Reserved! Pay cash at the front desk and the team will activate your
        membership on the spot.
      </div>
    )
  }

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {showCode ? (
        <Input
          placeholder="Discount code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={pending}
          maxLength={60}
          className="mb-2 uppercase"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowCode(true)}
          className="block text-xs text-turquoise-700 hover:text-turquoise-900 underline mb-2"
        >
          Have a discount code?
        </button>
      )}
      <Button
        onClick={() => onClick(false)}
        disabled={pending}
        className={fullWidth ? 'w-full' : ''}
        size="default"
      >
        {pending ? 'Taking you to Wam…' : `Pay ${priceLabel} with Wam`}
      </Button>
      <button
        type="button"
        onClick={() => onClick(true)}
        disabled={pending}
        className="block mx-auto text-xs text-neutral-600 hover:text-neutral-900 underline mt-2"
      >
        Or pay cash at the front desk
      </button>
      {error && (
        <p className="text-xs text-red-700 mt-2 text-center">{error}</p>
      )}
    </div>
  )
}
