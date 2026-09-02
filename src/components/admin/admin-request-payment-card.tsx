'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { adminRequestPayment } from '@/app/admin/members/[id]/actions'

export interface RequestableProduct {
  kind: 'plan' | 'pass'
  id: string
  name: string
  priceCents: number
}

interface Props {
  userId: string
  products: RequestableProduct[]
  addonsTotalCents: number
}

// Assign a plan/pass and send the member a pay link. Nothing activates
// until they pay — the pending payment provisions itself on success.
export default function AdminRequestPaymentCard({
  userId,
  products,
  addonsTotalCents,
}: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState('')
  const [includeAddons, setIncludeAddons] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const product = products.find((p) => `${p.kind}:${p.id}` === selected)
  const withAddons =
    product?.kind === 'plan' && includeAddons ? addonsTotalCents : 0
  const totalCents = (product?.priceCents ?? 0) + withAddons

  const submit = () => {
    if (!product) return
    setError(null)
    setSent(null)
    startTransition(async () => {
      const result = await adminRequestPayment({
        userId,
        kind: product.kind,
        productId: product.id,
        includeAddons: product.kind === 'plan' && includeAddons,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSent(
        `Request sent — TTD $${(result.amountCents / 100).toFixed(0)}. It activates when they pay.`
      )
      setSelected('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <Select value={selected} onValueChange={setSelected} disabled={isPending}>
        <SelectTrigger>
          <SelectValue placeholder="Pick a plan or pass…" />
        </SelectTrigger>
        <SelectContent>
          {products.map((p) => (
            <SelectItem key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>
              {p.name} · ${(p.priceCents / 100).toFixed(0)} (
              {p.kind === 'plan' ? 'plan' : 'pass'})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {product?.kind === 'plan' && addonsTotalCents > 0 && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={includeAddons}
            onCheckedChange={(v) => setIncludeAddons(v === true)}
            disabled={isPending}
          />
          Include add-ons (+TTD ${(addonsTotalCents / 100).toFixed(0)})
        </label>
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}
      {sent && <p className="text-sm text-turquoise-700">{sent}</p>}

      <Button
        type="button"
        size="sm"
        disabled={isPending || !product}
        onClick={submit}
      >
        <Send size={14} className="mr-1.5" />
        {isPending
          ? 'Sending…'
          : product
            ? `Request TTD $${(totalCents / 100).toFixed(0)}`
            : 'Request payment'}
      </Button>
      <p className="text-xs text-neutral-500">
        They get an email with a pay link plus an in-app message. The product
        stays inactive until the payment goes through, then activates on its
        own.
      </p>
    </div>
  )
}
