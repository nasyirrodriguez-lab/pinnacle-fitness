'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, TicketPercent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  adminCreateDiscountCode,
  adminSetDiscountCodeActive,
  adminDeleteDiscountCode,
  adminUpdateDiscountCode,
} from '@/app/admin/catalog/codes/actions'

export interface CodeProduct {
  kind: 'plan' | 'pass'
  id: string
  name: string
}

export interface CodeUsageEntry {
  memberName: string
  amountCents: number
  status: string
  at: string
}

export interface DiscountCodeRow {
  id: string
  code: string
  percentOff: number
  appliesTo: { kind: 'plan' | 'pass'; id: string }[]
  maxUsesPerMember: number | null
  expiresAt: string | null
  isActive: boolean
  uses: number
  revenueCents: number
  usage: CodeUsageEntry[]
}

interface Props {
  codes: DiscountCodeRow[]
  products: CodeProduct[]
}

export default function DiscountCodesManager({ codes, products }: Props) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [percent, setPercent] = useState('10')
  const [limit, setLimit] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const key = (p: { kind: string; id: string }) => `${p.kind}:${p.id}`
  const productName = (kind: string, id: string) =>
    products.find((p) => p.kind === kind && p.id === id)?.name ?? id

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        setError(result.error ?? 'Something went wrong')
        return
      }
      router.refresh()
    })
  }

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    const pct = Number(percent)
    const lim = limit.trim() ? Number(limit) : null
    run(() =>
      adminCreateDiscountCode({
        code: code.trim(),
        percentOff: pct,
        maxUsesPerMember: lim,
        expiresAt: expiresAt || null,
        items: products
          .filter((p) => selected.has(key(p)))
          .map((p) => ({ kind: p.kind, id: p.id })),
      })
    )
    setCode('')
    setLimit('')
    setExpiresAt('')
    setSelected(new Set())
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={create}
        className="bg-white border border-neutral-200 rounded-lg p-5 space-y-4"
      >
        <h2 className="font-heading text-lg">New code</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
              Code
            </label>
            <Input
              placeholder="FULLBLOOM10"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={isPending}
              maxLength={40}
              className="uppercase"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
              Percent off
            </label>
            <Input
              type="number"
              min={1}
              max={100}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
              Uses per member
            </label>
            <Input
              type="number"
              min={1}
              placeholder="Unlimited"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
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

        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
            Applies to — leave everything unticked for all plans &amp; passes
          </p>
          <div className="flex flex-wrap gap-2">
            {products.map((p) => {
              const k = key(p)
              const on = selected.has(k)
              return (
                <label
                  key={k}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm cursor-pointer ${
                    on
                      ? 'border-turquoise-500 bg-turquoise-50 text-turquoise-900'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                  }`}
                >
                  <Checkbox
                    checked={on}
                    onCheckedChange={() => {
                      const next = new Set(selected)
                      if (on) next.delete(k)
                      else next.add(k)
                      setSelected(next)
                    }}
                    disabled={isPending}
                    className="hidden"
                  />
                  {p.name}
                </label>
              )
            })}
          </div>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <Button
          type="submit"
          disabled={
            isPending ||
            code.trim().length < 3 ||
            !Number.isInteger(Number(percent)) ||
            Number(percent) < 1 ||
            Number(percent) > 100
          }
        >
          <Plus size={15} className="mr-1" />
          Create code
        </Button>
      </form>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
          <TicketPercent size={18} className="text-darkOrange-700" />
          <h2 className="font-heading text-lg">Codes</h2>
        </div>
        {codes.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">
            No codes yet. Create one above and share it with members.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {codes.map((c) => (
              <CodeRow
                key={c.id}
                code={c}
                products={products}
                productName={productName}
                isPending={isPending}
                run={run}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function fmtTtd(cents: number): string {
  return `TTD $${(cents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

function CodeRow({
  code: c,
  products,
  productName,
  isPending,
  run,
}: {
  code: DiscountCodeRow
  products: CodeProduct[]
  productName: (kind: string, id: string) => string
  isPending: boolean
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [codeText, setCodeText] = useState(c.code)
  const [percent, setPercent] = useState(String(c.percentOff))
  const [limit, setLimit] = useState(
    c.maxUsesPerMember != null ? String(c.maxUsesPerMember) : ''
  )
  const [expiresAt, setExpiresAt] = useState(
    c.expiresAt ? c.expiresAt.slice(0, 10) : ''
  )
  const [selected, setSelected] = useState<Set<string>>(
    new Set(c.appliesTo.map((a) => `${a.kind}:${a.id}`))
  )

  const save = () => {
    run(() =>
      adminUpdateDiscountCode({
        codeId: c.id,
        code: codeText.trim(),
        percentOff: Number(percent),
        maxUsesPerMember: limit.trim() ? Number(limit) : null,
        expiresAt: expiresAt || null,
        items: products
          .filter((p) => selected.has(`${p.kind}:${p.id}`))
          .map((p) => ({ kind: p.kind, id: p.id })),
      })
    )
    setEditing(false)
  }

  return (
    <li className="px-6 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono font-medium">
            {c.code}
            <span className="ml-2 font-sans text-sm text-neutral-600">
              {c.percentOff}% off
            </span>
            {!c.isActive && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-sans font-medium rounded bg-neutral-200 text-neutral-700">
                Inactive
              </span>
            )}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {c.appliesTo.length === 0
              ? 'All plans & passes'
              : c.appliesTo.map((a) => productName(a.kind, a.id)).join(', ')}
            {c.maxUsesPerMember != null &&
              ` · max ${c.maxUsesPerMember}/member`}
            {c.expiresAt && ` · ends ${c.expiresAt.slice(0, 10)}`}
            {` · used ${c.uses}× · ${fmtTtd(c.revenueCents)} paid`}
          </p>
          {c.usage.length > 0 && (
            <details className="mt-1.5">
              <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-900">
                Who used it
              </summary>
              <ul className="mt-1.5 space-y-0.5 text-xs text-neutral-600">
                {c.usage.map((u, i) => (
                  <li key={i}>
                    {u.memberName} · {fmtTtd(u.amountCents)}
                    {u.status !== 'succeeded' && ` (${u.status})`}
                    {u.at && ` · ${u.at.slice(0, 10)}`}
                  </li>
                ))}
                {c.uses > c.usage.length && (
                  <li className="text-neutral-400">
                    …and {c.uses - c.usage.length} more
                  </li>
                )}
              </ul>
            </details>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setEditing((v) => !v)}
            className="px-2 py-1 text-xs font-medium border border-neutral-200 rounded-md text-neutral-600 hover:text-neutral-900 hover:border-neutral-400"
          >
            {editing ? 'Close' : 'Edit'}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(() =>
                adminSetDiscountCodeActive({
                  codeId: c.id,
                  isActive: !c.isActive,
                })
              )
            }
            className="px-2 py-1 text-xs font-medium border border-neutral-200 rounded-md text-neutral-600 hover:text-neutral-900 hover:border-neutral-400"
          >
            {c.isActive ? 'Deactivate' : 'Reactivate'}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => adminDeleteDiscountCode({ codeId: c.id }))}
            className="p-1.5 text-neutral-400 hover:text-red-700"
            aria-label={`Delete ${c.code}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 bg-neutral-50 border border-neutral-200 rounded-md p-4 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
                Code
              </label>
              <Input
                value={codeText}
                onChange={(e) => setCodeText(e.target.value.toUpperCase())}
                maxLength={40}
                className="uppercase"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
                Percent off
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
                Uses per member
              </label>
              <Input
                type="number"
                min={1}
                placeholder="Unlimited"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
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
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {products.map((p) => {
              const k = `${p.kind}:${p.id}`
              const on = selected.has(k)
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    const next = new Set(selected)
                    if (on) next.delete(k)
                    else next.add(k)
                    setSelected(next)
                  }}
                  className={`inline-flex items-center px-2.5 py-1 rounded-full border text-sm ${
                    on
                      ? 'border-turquoise-500 bg-turquoise-50 text-turquoise-900'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                  }`}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={
              isPending ||
              codeText.trim().length < 3 ||
              !Number.isInteger(Number(percent)) ||
              Number(percent) < 1 ||
              Number(percent) > 100
            }
            onClick={save}
          >
            Save changes
          </Button>
        </div>
      )}
    </li>
  )
}
