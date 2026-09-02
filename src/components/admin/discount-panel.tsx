'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BadgePercent, Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  applyCatalogDiscount,
  clearCatalogDiscount,
} from '@/app/admin/catalog/actions'

export interface DiscountableProduct {
  kind: 'plan' | 'pass'
  id: string
  name: string
  priceCents: number
  discountedPriceCents: number | null
  discountLabel: string | null
  discountExpiresAt: string | null
}

interface Props {
  products: DiscountableProduct[]
}

// One campaign, many products: name the deal ("Full Bloom"), set a
// percentage and an optional end date, tick the plans/passes it covers.
export default function DiscountPanel({ products }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [label, setLabel] = useState('')
  const [percent, setPercent] = useState('10')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const key = (p: { kind: string; id: string }) => `${p.kind}:${p.id}`

  const toggle = (p: DiscountableProduct) => {
    const next = new Set(selected)
    const k = key(p)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setSelected(next)
    setDone(null)
  }

  const items = useMemo(
    () =>
      products
        .filter((p) => selected.has(key(p)))
        .map((p) => ({ kind: p.kind, id: p.id })),
    [products, selected]
  )

  const pct = Number(percent)
  const validPct = Number.isInteger(pct) && pct >= 1 && pct <= 95

  const apply = () => {
    setError(null)
    setDone(null)
    startTransition(async () => {
      const result = await applyCatalogDiscount({
        items,
        percentOff: pct,
        label: label.trim(),
        expiresAt: expiresAt || null,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDone(`Discount applied to ${items.length} item(s).`)
      setSelected(new Set())
      router.refresh()
    })
  }

  const clear = () => {
    setError(null)
    setDone(null)
    startTransition(async () => {
      const result = await clearCatalogDiscount({ items })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDone(`Discount removed from ${items.length} item(s).`)
      setSelected(new Set())
      router.refresh()
    })
  }

  const fmt = (cents: number) => `$${(cents / 100).toLocaleString('en-US')}`

  return (
    <div className="space-y-5">
      <div className="bg-white border border-neutral-200 rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
              Discount name
            </label>
            <Input
              placeholder="e.g. Full Bloom"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isPending}
              maxLength={80}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
              Percent off
            </label>
            <Input
              type="number"
              min={1}
              max={95}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
              Ends (optional)
            </label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={
              isPending || items.length === 0 || !validPct || !label.trim()
            }
            onClick={apply}
          >
            <BadgePercent size={15} className="mr-1" />
            {isPending
              ? 'Working…'
              : `Apply to ${items.length || '…'} selected`}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending || items.length === 0}
            onClick={clear}
          >
            <Eraser size={15} className="mr-1" />
            Remove discount from selected
          </Button>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {done && <p className="text-sm text-turquoise-700">{done}</p>}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <ul className="divide-y divide-neutral-100">
          {products.map((p) => {
            const k = key(p)
            const active = p.discountedPriceCents != null
            return (
              <li key={k}>
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50">
                  <Checkbox
                    checked={selected.has(k)}
                    onCheckedChange={() => toggle(p)}
                    disabled={isPending}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">
                      {p.name}
                      <span className="ml-2 text-xs font-normal uppercase tracking-wide text-neutral-400">
                        {p.kind}
                      </span>
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {fmt(p.priceCents)}
                      {active && (
                        <>
                          {' → '}
                          <span className="text-darkOrange-700 font-medium">
                            {fmt(p.discountedPriceCents!)}
                          </span>
                          {p.discountLabel && ` · ${p.discountLabel}`}
                          {p.discountExpiresAt &&
                            ` · ends ${p.discountExpiresAt.slice(0, 10)}`}
                        </>
                      )}
                    </span>
                  </span>
                  {active && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-darkOrange-50 text-darkOrange-800 shrink-0">
                      Discounted
                    </span>
                  )}
                </label>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
