'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { ArrowLeft, CheckCircle2, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Product { id: string; name: string; variant: string | null; priceCents: number; stock: number }
interface Seller { id: string; name: string }
interface Member { id: string; fullName: string | null; email: string }

type Stage =
  | { kind: 'loading' }
  | { kind: 'seller' }
  | { kind: 'sell' }
  | { kind: 'wam'; paymentId: string; checkoutUrl: string; totalCents: number }
  | { kind: 'done'; totalCents: number; method: 'cash' | 'wam' }
  | { kind: 'error'; message: string }

function ttd(c: number) { return `TT$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}` }

// The fridge, sold from the check-in iPad. A team PIN stamps who sold
// it; the member is optional; cash settles now, Wam settles by QR.
export default function ShopClient() {
  const [stage, setStage] = useState<Stage>({ kind: 'loading' })
  const [products, setProducts] = useState<Product[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [sellerId, setSellerId] = useState('')
  const [pin, setPin] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Member[]>([])
  const [member, setMember] = useState<Member | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [qrSvg, setQrSvg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/checkin/shop', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setStage({ kind: 'error', message: 'Could not load the shop.' }); return }
      setProducts(data.products ?? [])
      setSellers(data.sellers ?? [])
      setStage({ kind: 'seller' })
    })()
  }, [])

  useEffect(() => {
    if (stage.kind !== 'wam') return
    let cancelled = false
    void (async () => {
      const QRCode = (await import('qrcode')).default
      const svg = await QRCode.toString(stage.checkoutUrl, { type: 'svg', margin: 1, width: 240 })
      if (!cancelled) setQrSvg(svg)
    })()
    const t = window.setInterval(async () => {
      const res = await fetch(`/api/checkin/shop?paymentId=${stage.paymentId}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (data.status === 'succeeded') setStage({ kind: 'done', totalCents: stage.totalCents, method: 'wam' })
    }, 3000)
    return () => { cancelled = true; window.clearInterval(t) }
  }, [stage])

  const search = (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) { setResults([]); return }
    void fetch(`/api/checkin/search?q=${encodeURIComponent(q.trim())}`).then((r) => r.json()).then((d) => setResults(d.results ?? [])).catch(() => setResults([]))
  }

  const total = Object.entries(cart).reduce((s, [id, q]) => s + (products.find((p) => p.id === id)?.priceCents ?? 0) * q, 0)

  const sell = (method: 'cash' | 'wam') => {
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/checkin/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId, sellerPin: pin, memberId: member?.id ?? null, method, items: Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity })) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error === 'seller_pin' ? 'That PIN didn’t match.' : data.error === 'out_of_stock' ? `Out of stock: ${data.product}` : data.error === 'no_price' ? 'Prices aren’t set yet — ask an owner.' : 'Could not complete the sale.')
        return
      }
      if (data.status === 'paid') { setStage({ kind: 'done', totalCents: data.totalCents, method: 'cash' }); setCart({}) }
      else setStage({ kind: 'wam', paymentId: data.paymentId, checkoutUrl: data.checkoutUrl, totalCents: data.totalCents })
    })
  }

  if (stage.kind === 'loading') return <p className="text-neutral-500">Loading…</p>
  if (stage.kind === 'error') return <p className="text-red-700">{stage.message}</p>

  if (stage.kind === 'done') {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-10 text-center">
        <CheckCircle2 size={56} className="mx-auto text-turquoise-500 mb-3" />
        <h2 className="font-heading text-3xl mb-1">{ttd(stage.totalCents)} · {stage.method === 'cash' ? 'cash taken' : 'paid by Wam'}</h2>
        <p className="text-neutral-600 mb-6">Stock updated. Enjoy.</p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => { setCart({}); setMember(null); setStage({ kind: 'sell' }) }}>Next sale</Button>
          <Link href="/checkin"><Button variant="outline">Back to check-in</Button></Link>
        </div>
      </div>
    )
  }

  if (stage.kind === 'wam') {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-10 text-center">
        <h2 className="font-heading text-2xl mb-1">Pay {ttd(stage.totalCents)} on your phone</h2>
        <p className="text-sm text-neutral-600 mb-4">Scan with your camera to pay with Wam. This updates the moment it goes through.</p>
        {qrSvg ? <div className="inline-block bg-white p-3 rounded-lg border border-neutral-200 [&_svg]:w-56 [&_svg]:h-56" dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <p className="text-neutral-500">Preparing QR…</p>}
        <p className="text-xs text-neutral-500 mt-4">Waiting for payment… cash works too — a team member can re-ring it.</p>
        <button type="button" onClick={() => setStage({ kind: 'sell' })} className="mt-4 text-sm underline text-neutral-600">Back</button>
      </div>
    )
  }

  if (stage.kind === 'seller') {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-8 max-w-md mx-auto">
        <Link href="/checkin" className="inline-flex items-center gap-1 text-sm text-neutral-600 mb-4"><ArrowLeft size={16} /> Back</Link>
        <h1 className="font-heading text-2xl mb-1">Who&apos;s selling?</h1>
        <p className="text-sm text-neutral-600 mb-4">Pick your name and enter your PIN — the sale is logged under you.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {sellers.map((s) => (
            <button key={s.id} type="button" onClick={() => setSellerId(s.id)} className={sellerId === s.id ? 'px-3 py-2 rounded-full bg-turquoise-500 text-black text-sm font-semibold' : 'px-3 py-2 rounded-full border border-neutral-300 text-sm'}>{s.name}</button>
          ))}
          {sellers.length === 0 && <p className="text-sm text-neutral-500">No team member has a PIN yet — set one in Admin → Members.</p>}
        </div>
        <Input inputMode="numeric" maxLength={4} placeholder="4-digit PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className="mb-4 text-center font-stat text-2xl" />
        <Button disabled={!sellerId || pin.length !== 4} onClick={() => setStage({ kind: 'sell' })} className="w-full">Open the shop</Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-heading text-2xl flex items-center gap-2"><ShoppingBag size={22} className="text-turquoise-700" /> Shop</h1>
          <button type="button" onClick={() => setStage({ kind: 'seller' })} className="text-xs text-neutral-500 underline">Switch seller</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {products.map((p) => {
            const q = cart[p.id] ?? 0
            return (
              <button key={p.id} type="button" disabled={p.stock <= q} onClick={() => setCart((c) => ({ ...c, [p.id]: q + 1 }))} className={q > 0 ? 'text-left rounded-lg p-4 bg-turquoise-500 text-black' : 'text-left rounded-lg p-4 bg-white border border-neutral-200 hover:border-turquoise-500 disabled:opacity-40'}>
                <p className="font-medium leading-tight">{p.name}</p>
                {p.variant && <p className="text-xs opacity-70">{p.variant}</p>}
                <p className="font-stat text-xl mt-2">{ttd(p.priceCents)}</p>
                <p className="text-[11px] opacity-70">{p.stock} left{q > 0 && ` · ${q} in cart`}</p>
              </button>
            )
          })}
        </div>
      </div>
      <div className="bg-white border border-neutral-200 rounded-lg p-5 h-fit">
        <h2 className="font-heading text-lg mb-3">Cart</h2>
        {Object.keys(cart).length === 0 ? <p className="text-sm text-neutral-500">Tap products to add them.</p> : (
          <ul className="space-y-2 mb-3">
            {Object.entries(cart).map(([id, q]) => {
              const p = products.find((x) => x.id === id)
              if (!p) return null
              return (
                <li key={id} className="flex items-center justify-between text-sm">
                  <span>{p.name}{p.variant ? ` ${p.variant}` : ''} × {q}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-stat">{ttd(p.priceCents * q)}</span>
                    <button type="button" onClick={() => setCart((c) => { const n = { ...c }; if (n[id] > 1) n[id] -= 1; else delete n[id]; return n })} className="text-neutral-500 text-xs">−</button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        <div className="border-t border-neutral-100 pt-3 mb-3">
          <p className="text-xs text-neutral-500 mb-1">Member (optional)</p>
          {member ? (
            <p className="text-sm flex items-center justify-between">{member.fullName ?? member.email}<button type="button" onClick={() => setMember(null)} className="text-xs text-neutral-500 underline">clear</button></p>
          ) : (
            <>
              <Input placeholder="Find a member" value={query} onChange={(e) => search(e.target.value)} className="h-9" />
              {results.length > 0 && (
                <ul className="mt-1 border border-neutral-200 rounded-md divide-y divide-neutral-100 max-h-40 overflow-y-auto">
                  {results.map((r) => (
                    <li key={r.id}><button type="button" onClick={() => { setMember(r); setResults([]); setQuery('') }} className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50">{r.fullName ?? r.email}</button></li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        <p className="font-stat text-3xl mb-3">{ttd(total)}</p>
        {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={isPending || total <= 0} onClick={() => sell('cash')}>Cash</Button>
          <Button variant="outline" disabled={isPending || total <= 0} onClick={() => sell('wam')}>Wam QR</Button>
        </div>
      </div>
    </div>
  )
}
