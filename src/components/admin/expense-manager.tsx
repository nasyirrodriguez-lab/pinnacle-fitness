'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  adminAddExpense,
  adminDeleteExpense,
  adminEndRecurringExpense,
} from '@/app/admin/finance/actions'

export interface ExpenseRow {
  id: string
  label: string
  category: string
  amountCents: number
  isRecurring: boolean
  incurredOn: string | null
  startsOn: string | null
  endsOn: string | null
}

const CATEGORIES = [
  'rent',
  'utilities',
  'internet',
  'staff',
  'cleaning',
  'supplies',
  'equipment',
  'marketing',
  'software',
  'general',
]

function fmtTtd(cents: number): string {
  return `TTD $${(cents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

export default function ExpenseManager({
  expenses,
  monthKey,
}: {
  expenses: ExpenseRow[]
  monthKey: string
}) {
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('general')
  const [amount, setAmount] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [date, setDate] = useState(`${monthKey}-01`)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const add = () => {
    setError(null)
    startTransition(async () => {
      const r = await adminAddExpense({
        label: label.trim(),
        category,
        amountCents: Math.round(Number(amount) * 100),
        isRecurring: recurring,
        incurredOn: recurring ? null : date,
        startsOn: recurring ? date : null,
        endsOn: null,
        notes: null,
      })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setLabel('')
      setAmount('')
      router.refresh()
    })
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
        <Input
          placeholder="Expense — e.g. Electricity"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="col-span-2"
          maxLength={200}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-neutral-300 px-2 text-sm bg-white capitalize"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={1}
          placeholder="TTD"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-4 mb-4">
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          Fixed monthly expense (repeats every month from this date)
        </label>
        <Button
          type="button"
          size="sm"
          disabled={
            isPending ||
            !label.trim() ||
            !Number.isFinite(Number(amount)) ||
            Number(amount) <= 0
          }
          onClick={add}
        >
          <Plus size={14} className="mr-1" />
          Add
        </Button>
      </div>
      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

      {expenses.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No expenses recorded for this month yet.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="py-2.5 flex items-center justify-between gap-3"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium truncate">
                  {e.label}
                  {e.isRecurring && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-darkBlue-100 text-darkBlue-900">
                      FIXED MONTHLY
                    </span>
                  )}
                </span>
                <span className="block text-xs text-neutral-500 capitalize">
                  {e.category}
                  {e.isRecurring
                    ? ` · since ${e.startsOn}${e.endsOn ? ` · ends ${e.endsOn}` : ''}`
                    : ` · ${e.incurredOn}`}
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-medium">
                  {fmtTtd(e.amountCents)}
                </span>
                {e.isRecurring && !e.endsOn && (
                  <button
                    type="button"
                    disabled={isPending}
                    title="Stop this recurring expense at the end of this month"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await adminEndRecurringExpense({
                          expenseId: e.id,
                          endsOn: `${monthKey}-28`,
                        })
                        if (!r.ok) setError(r.error)
                        else router.refresh()
                      })
                    }
                    className="px-2 py-1 text-xs font-medium border border-neutral-200 rounded text-neutral-600 hover:border-neutral-400"
                  >
                    End
                  </button>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await adminDeleteExpense({ expenseId: e.id })
                      if (!r.ok) setError(r.error)
                      else router.refresh()
                    })
                  }
                  className="p-1.5 text-neutral-400 hover:text-red-700"
                  aria-label={`Delete ${e.label}`}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
