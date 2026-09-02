'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { startDayPassPurchase } from '@/lib/checkout/buy-day-pass'

interface Props {
  passId: string
  priceLabel: string
  fullWidth?: boolean
}

export default function PayPassButton({
  passId,
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
    const result = await startDayPassPurchase({
      signedIn: true,
      passId,
      returnPath: `/buy/${passId}`,
      discountCode: code.trim() || undefined,
      payAtDesk,
    })
    if (!result.ok) {
      setError(result.error)
      setPending(false)
      return
    }
    if (result.payAtDesk) {
      setReserved(true)
      setPending(false)
    }
    // On online success we navigate to Wam, no need to reset pending.
  }

  if (reserved) {
    return (
      <div
        className={`bg-lime-50 border border-lime-200 rounded-md p-3 text-sm text-lime-900 ${fullWidth ? 'w-full' : ''}`}
      >
        Reserved! Pay cash at the desk and a coach will activate it on
        the spot.
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
        Or pay cash at the desk
      </button>
      {error && (
        <p className="text-xs text-red-700 mt-2 text-center">{error}</p>
      )}
    </div>
  )
}
