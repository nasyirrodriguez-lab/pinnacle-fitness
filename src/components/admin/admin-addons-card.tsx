'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  adminAddMemberAddon,
  adminRemoveMemberAddon,
} from '@/app/admin/members/[id]/actions'

export interface AddonRow {
  id: string
  label: string
  amountCents: number
  expiresAt: string | null
}

interface Props {
  userId: string
  addons: AddonRow[]
}

// Per-member recurring extras — locker, signage, extra desk. Charged
// with the plan when requesting payment; shown so renewals include them.
export default function AdminAddonsCard({ userId, addons }: Props) {
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [periodAmount, setPeriodAmount] = useState('')
  const [periodUnit, setPeriodUnit] = useState('months')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const totalCents = addons.reduce((sum, a) => sum + a.amountCents, 0)
  const parsed = Number.parseFloat(amount)

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const parsedPeriod = Number.parseFloat(periodAmount)
      const result = await adminAddMemberAddon({
        userId,
        label: label.trim(),
        amountCents: Math.round(parsed * 100),
        periodAmount:
          Number.isFinite(parsedPeriod) && parsedPeriod > 0
            ? parsedPeriod
            : null,
        periodUnit:
          Number.isFinite(parsedPeriod) && parsedPeriod > 0
            ? (periodUnit as 'minutes' | 'hours' | 'days' | 'months')
            : null,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setLabel('')
      setAmount('')
      setPeriodAmount('')
      router.refresh()
    })
  }

  const remove = (addonId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await adminRemoveMemberAddon({ userId, addonId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {addons.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No add-ons. Attach extras like a locker or signage and they get
          charged with the plan.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {addons.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-neutral-100 last:border-0"
            >
              <span className="min-w-0">
                <span className="block font-medium truncate">{a.label}</span>
                {a.expiresAt && (
                  <span className="block text-xs text-neutral-500">
                    ends {a.expiresAt.slice(0, 10)}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span>TTD ${(a.amountCents / 100).toFixed(0)}/mo</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => remove(a.id)}
                  className="p-1 rounded-full text-neutral-400 hover:text-red-700 hover:bg-neutral-100"
                  aria-label={`Remove ${a.label}`}
                >
                  <X size={13} />
                </button>
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between text-sm pt-1 font-medium">
            <span>Add-ons total</span>
            <span>TTD ${(totalCents / 100).toFixed(0)}/mo</span>
          </li>
        </ul>
      )}

      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Add-on, e.g. Locker"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={isPending}
          maxLength={120}
          className="h-9"
        />
        <Input
          type="number"
          min={0}
          step={1}
          placeholder="$/mo"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isPending}
          className="h-9 w-24"
        />
        <Input
          type="number"
          min={0.5}
          step={0.5}
          placeholder="For…"
          value={periodAmount}
          onChange={(e) => setPeriodAmount(e.target.value)}
          disabled={isPending}
          className="h-9 w-20"
        />
        <select
          value={periodUnit}
          onChange={(e) => setPeriodUnit(e.target.value)}
          disabled={isPending}
          className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
          aria-label="Period unit"
        >
          <option value="minutes">mins</option>
          <option value="hours">hrs</option>
          <option value="days">days</option>
          <option value="months">months</option>
        </select>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={
            isPending || !label.trim() || !Number.isFinite(parsed) || parsed < 0
          }
        >
          <Plus size={14} />
        </Button>
      </form>
      <p className="text-xs text-neutral-500">
        Leave &ldquo;For…&rdquo; blank for an ongoing add-on; set it and the
        add-on ends by itself.
      </p>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
