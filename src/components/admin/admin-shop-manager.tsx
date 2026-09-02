'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminSaveProduct, adminRestock } from '@/app/admin/shop/actions'

export interface ProductRow { id: string; name: string; variant: string; priceCents: number; stock: number; isActive: boolean }

function ttd(c: number) { return `TT$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}` }

export default function AdminShopManager({ products }: { products: ProductRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [name, setName] = useState('')
  const [variant, setVariant] = useState('')
  const [price, setPrice] = useState('')
  const [restock, setRestock] = useState<Record<string, string>>({})

  const open = (p?: ProductRow) => {
    setEditing(p ? p.id : 'new')
    setName(p?.name ?? ''); setVariant(p?.variant ?? ''); setPrice(p ? String(p.priceCents / 100) : '')
  }
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) { setError(r.error ?? 'Something went wrong'); return }
      setEditing(null)
      router.refresh()
    })
  }
  const form = (p?: ProductRow) => (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px_auto] gap-2 items-end bg-neutral-50 border border-neutral-200 rounded-md p-3">
      <label className="text-xs text-neutral-500">Product<Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-9" /></label>
      <label className="text-xs text-neutral-500">Variant<Input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="Vanilla" maxLength={60} className="h-9" /></label>
      <label className="text-xs text-neutral-500">TT$<Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 font-stat" /></label>
      <span className="flex gap-2">
        <Button size="sm" disabled={isPending || !name.trim()} onClick={() => run(() => adminSaveProduct({ id: p?.id, name, variant, priceCents: Math.round(Number(price || 0) * 100), isActive: p?.isActive ?? true }))}>Save</Button>
        <button type="button" onClick={() => setEditing(null)} className="text-xs text-neutral-500">Cancel</button>
      </span>
    </div>
  )

  return (
    <div className="space-y-4">
      {editing === 'new' ? form() : <Button variant="outline" size="sm" onClick={() => open()}>+ Add product</Button>}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="text-left px-4 py-2">Product</th><th className="text-right px-4 py-2">Price</th><th className="text-right px-4 py-2">Stock</th><th className="px-4 py-2">Restock</th><th className="px-4 py-2"></th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {products.map((p) => (
              <tr key={p.id} className={p.isActive ? '' : 'opacity-50'}>
                <td className="px-4 py-2 font-medium">{p.name}{p.variant && <span className="text-neutral-500 font-normal"> · {p.variant}</span>}{p.priceCents === 0 && <span className="ml-2 text-[10px] font-semibold text-orange-700">NO PRICE</span>}</td>
                <td className="px-4 py-2 text-right font-stat">{ttd(p.priceCents)}</td>
                <td className={p.stock < 5 ? 'px-4 py-2 text-right font-stat text-orange-700' : 'px-4 py-2 text-right font-stat'}>{p.stock}{p.stock < 5 && <span className="block text-[10px] font-sans">low</span>}</td>
                <td className="px-4 py-2">
                  <span className="inline-flex gap-1">
                    <Input type="number" placeholder="+12" value={restock[p.id] ?? ''} onChange={(e) => setRestock((r) => ({ ...r, [p.id]: e.target.value }))} className="h-8 w-20" />
                    <button type="button" disabled={isPending || !Number(restock[p.id])} onClick={() => { const d = Number(restock[p.id]); run(() => adminRestock({ productId: p.id, delta: d, reason: d > 0 ? 'restock' : 'adjust' })); setRestock((r) => ({ ...r, [p.id]: '' })) }} className="px-2 text-xs font-semibold rounded-full bg-turquoise-500 text-black disabled:opacity-40">Add</button>
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button type="button" onClick={() => open(p)} className="text-xs text-neutral-600 underline mr-3">Edit</button>
                  <button type="button" onClick={() => run(() => adminSaveProduct({ id: p.id, name: p.name, variant: p.variant, priceCents: p.priceCents, isActive: !p.isActive }))} className="text-xs text-neutral-600 underline">{p.isActive ? 'Hide' : 'Show'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {editing && editing !== 'new' && <div className="p-3 border-t border-neutral-200">{form(products.find((p) => p.id === editing))}</div>}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  )
}
