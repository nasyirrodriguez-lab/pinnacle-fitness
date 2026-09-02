'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Search, CheckCircle2, AlertCircle, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface KioskPass {
  id: string
  name: string
  priceCents: number
  currency: string
  usesTotal: number
  validityDays: number
  sessionKind: 'pt' | 'open_gym'
}

const Scanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then((m) => m.Scanner),
  { ssr: false }
)

interface SearchResult {
  id: string
  fullName: string | null
  email: string
}

type Member = { id: string; fullName: string | null; email: string }
type BookingInfo = { coachName: string; startLabel: string }
type FloorInfo = { onFloor: number; cap: number }

type MemberCheckinResponse =
  | {
      status: 'checked_in'
      member: Member
      via: 'pt' | 'open_gym' | 'team'
      booking?: BookingInfo
      ptLeft?: number | null
      openGymLeft?: number | null
      grace?: { lapsedDays: number; planName: string | null } | null
      floor?: FloorInfo
    }
  | { status: 'already_checked_in'; member: Member; since?: string }
  | {
      status: 'needs_payment'
      kind: 'pt' | 'open_gym'
      member: Member
      title: string
      body: string
      booking?: BookingInfo
      lateBooking?: BookingInfo | null
    }
  | {
      status: 'lapsed'
      member: Member
      lapsedDays: number
      planName: string | null
      title: string
      body: string
    }
  | { status: 'floor_full'; member: Member; floor: FloorInfo }
  | {
      status: 'pt_early'
      member: Member
      booking: BookingInfo
      earlyMinutes: number
    }

type View =
  | { kind: 'scan' }
  | { kind: 'searching' }
  | { kind: 'pin'; userId: string; label: string; error?: string }
  | { kind: 'submitting' }
  | { kind: 'success'; result: MemberCheckinResponse }
  | { kind: 'error'; message: string }

export default function MemberCheckinClient() {
  const [view, setView] = useState<View>({ kind: 'scan' })
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const searchTimer = useRef<number | null>(null)

  // Auto-return to scan after a success so the kiosk is ready for the next
  // person — but never while someone is mid-purchase on the needs_payment
  // screen (picking a pass / paying by phone takes minutes, not seconds).
  useEffect(() => {
    if (view.kind !== 'success') return
    if (view.result.status === 'needs_payment') return
    const t = window.setTimeout(() => {
      setView({ kind: 'scan' })
      setQuery('')
      setResults([])
    }, 8000)
    return () => window.clearTimeout(t)
  }, [view])

  const runSearch = (q: string) => {
    setQuery(q)
    if (searchTimer.current) window.clearTimeout(searchTimer.current)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    searchTimer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/checkin/search?q=${encodeURIComponent(q.trim())}`
        )
        if (!res.ok) {
          setResults([])
          return
        }
        const data = (await res.json()) as { results: SearchResult[] }
        setResults(data.results)
      } catch {
        setResults([])
      }
    }, 250)
  }

  const submitToken = async (token: string) => {
    setView({ kind: 'submitting' })
    try {
      const res = await fetch('/api/checkin/member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        setView({
          kind: 'error',
          message: humanError(data.error),
        })
        return
      }
      setView({ kind: 'success', result: data as MemberCheckinResponse })
    } catch {
      setView({ kind: 'error', message: 'Network error. Try again.' })
    }
  }

  // Name search has no QR to prove it's you, so it asks for the 4-digit
  // PIN set during onboarding before it does anything.
  const submitUser = (userId: string, label: string) => {
    setView({ kind: 'pin', userId, label })
  }

  const submitUserWithPin = async (
    userId: string,
    pin: string,
    label: string
  ) => {
    setView({ kind: 'submitting' })
    try {
      const res = await fetch('/api/checkin/member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, pin }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'pin_mismatch') {
          setView({
            kind: 'pin',
            userId,
            label,
            error: 'That PIN didn’t match. Try again.',
          })
          return
        }
        setView({ kind: 'error', message: humanError(data.error) })
        return
      }
      setView({ kind: 'success', result: data as MemberCheckinResponse })
    } catch {
      setView({ kind: 'error', message: 'Network error. Try again.' })
    }
  }

  if (view.kind === 'pin') {
    return (
      <ResultCard>
        <PinPad
          label={view.label}
          error={view.error}
          onBack={() => setView({ kind: 'scan' })}
          onSubmit={(pin) => submitUserWithPin(view.userId, pin, view.label)}
        />
      </ResultCard>
    )
  }

  if (view.kind === 'success') {
    const r = view.result
    const first = (r.member.fullName ?? r.member.email).split(' ')[0]
    return (
      <ResultCard>
        {r.status === 'needs_payment' ? (
          <NeedsPayment
            member={r.member}
            kind={r.kind}
            title={r.title}
            body={r.body}
            lateBooking={r.lateBooking ?? null}
          />
        ) : r.status === 'lapsed' ? (
          <NeedsPayment
            member={r.member}
            kind="open_gym"
            title={r.title}
            body={r.body}
            lateBooking={null}
            lapsed
          />
        ) : r.status === 'floor_full' ? (
          <>
            <AlertCircle size={48} className="text-orange-500 mb-3" />
            <h2 className="font-heading text-2xl mb-1">
              Floor’s full right now
            </h2>
            <p className="font-stat text-5xl text-turquoise-700 my-3">
              {r.floor.onFloor}
              <span className="font-sans text-lg text-neutral-500">
                {' '}
                of {r.floor.cap}
              </span>
            </p>
            <p className="text-sm text-neutral-600 max-w-sm">
              {first}, we cap the floor at {r.floor.cap} so everyone gets the
              space. Hang tight — the next scan-out opens a spot. A coach can
              also let you know when it’s clear.
            </p>
          </>
        ) : r.status === 'pt_early' ? (
          <>
            <CheckCircle2 size={48} className="text-turquoise-500 mb-3" />
            <h2 className="font-heading text-2xl mb-1">
              You’re early, {first}
            </h2>
            <p className="text-neutral-600 mb-2">
              PT with {r.booking.coachName} at{' '}
              <span className="font-stat text-2xl text-turquoise-700">
                {r.booking.startLabel}
              </span>
            </p>
            <p className="text-sm text-neutral-500 max-w-sm">
              Scan again from {r.earlyMinutes} minutes before your session and
              you’re in. Grab a water in the meantime.
            </p>
          </>
        ) : r.status === 'already_checked_in' ? (
          <>
            <CheckCircle2 size={56} className="text-turquoise-500 mb-3" />
            <h2 className="font-heading text-2xl mb-1">You’re already in</h2>
            <p className="text-neutral-600">
              {r.member.fullName ?? r.member.email} · use “Leaving” on the way
              out so the floor count stays right.
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 size={56} className="text-turquoise-500 mb-3" />
            <h2 className="font-heading text-3xl mb-1">Welcome in, {first}</h2>
            {r.via === 'pt' && r.booking && (
              <p className="text-neutral-600 mb-2">
                PT with {r.booking.coachName} ·{' '}
                <span className="font-stat text-xl">
                  {r.booking.startLabel}
                </span>
              </p>
            )}
            {r.via === 'open_gym' && (
              <p className="text-neutral-600 mb-2">Open gym · go get it.</p>
            )}
            {r.via === 'team' && (
              <p className="text-neutral-600 mb-2">Team · have a good one.</p>
            )}
            {typeof r.ptLeft === 'number' && (
              <p className="text-sm text-neutral-500">
                <span className="font-stat text-2xl text-turquoise-700">
                  {r.ptLeft}
                </span>{' '}
                PT session{r.ptLeft === 1 ? '' : 's'} left after today
              </p>
            )}
            {typeof r.openGymLeft === 'number' && (
              <p className="text-sm text-neutral-500">
                <span className="font-stat text-2xl text-turquoise-700">
                  {r.openGymLeft}
                </span>{' '}
                open-gym visit{r.openGymLeft === 1 ? '' : 's'} left
              </p>
            )}
            {r.grace && (
              <p className="text-sm text-orange-700 mt-2 max-w-sm">
                Heads up: your {r.grace.planName ?? 'plan'} renewal is{' '}
                {r.grace.lapsedDays} day{r.grace.lapsedDays === 1 ? '' : 's'}{' '}
                overdue — renew from your app before it pauses.
              </p>
            )}
            {r.floor && (
              <p className="text-xs text-neutral-400 mt-3">
                {r.floor.onFloor} of {r.floor.cap} on the floor
              </p>
            )}
          </>
        )}
      </ResultCard>
    )
  }

  if (view.kind === 'submitting') {
    return (
      <ResultCard>
        <p className="text-neutral-600">Checking you in…</p>
      </ResultCard>
    )
  }

  if (view.kind === 'error') {
    return (
      <ResultCard>
        <AlertCircle size={48} className="text-red-500 mb-3" />
        <h2 className="font-heading text-xl mb-2">Couldn&apos;t check in</h2>
        <p className="text-sm text-neutral-600 mb-4">{view.message}</p>
        <Button onClick={() => setView({ kind: 'scan' })}>Try again</Button>
      </ResultCard>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-200 flex items-center gap-2">
          <QrCode size={18} className="text-turquoise-700" />
          <h2 className="font-heading text-base">Scan your QR</h2>
        </div>
        <div className="bg-black aspect-square max-h-[360px] mx-auto w-full max-w-[360px]">
          <Scanner
            onScan={(codes) => {
              const value = codes[0]?.rawValue
              if (value) submitToken(value)
            }}
            onError={() => {
              /* ignore — fall back to search */
            }}
            constraints={{ facingMode: 'user' }}
            styles={{
              container: { width: '100%', height: '100%' },
              video: { width: '100%', height: '100%', objectFit: 'cover' },
            }}
          />
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <Search size={18} className="text-neutral-500" />
          <h2 className="font-heading text-base">Or find your name</h2>
        </div>
        <Input
          autoFocus={false}
          placeholder="Type your name or email"
          value={query}
          onChange={(e) => runSearch(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="mt-3 border border-neutral-200 rounded-md divide-y divide-neutral-100 max-h-64 overflow-y-auto">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => submitUser(r.id, r.fullName ?? r.email)}
                  className="w-full text-left px-3 py-3 hover:bg-neutral-50 text-sm"
                >
                  <p className="font-medium">{r.fullName ?? 'Member'}</p>
                  <p className="text-xs text-neutral-500">{r.email}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ResultCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-10 md:p-14 flex flex-col items-center text-center min-h-[340px]">
      {children}
    </div>
  )
}

interface PendingCheckout {
  paymentId: string
  checkoutUrl: string
  passName: string
  priceLabel: string
}

// The kiosk never navigates into Wam's hosted checkout: the check-in app
// runs as an installed standalone web app on the iPad, and iOS renders
// out-of-scope cross-origin pages in an in-app browser sheet where the
// card form silently fails to load. Instead we show the checkout link as
// a QR the member scans with their own phone, and poll until paid.
function PayByPhone({
  checkout,
  onBack,
}: {
  checkout: PendingCheckout
  onBack: () => void
}) {
  const [qrSvg, setQrSvg] = useState<string | null>(null)
  const [status, setStatus] = useState<'waiting' | 'paid' | 'failed'>('waiting')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const QRCode = (await import('qrcode')).default
      const svg = await QRCode.toString(checkout.checkoutUrl, {
        type: 'svg',
        margin: 1,
        width: 260,
      })
      if (!cancelled) setQrSvg(svg)
    })()
    return () => {
      cancelled = true
    }
  }, [checkout.checkoutUrl])

  useEffect(() => {
    if (status !== 'waiting') return
    const t = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/checkin/buy-pass?paymentId=${encodeURIComponent(checkout.paymentId)}`,
          { cache: 'no-store' }
        )
        if (!res.ok) return
        const data = (await res.json()) as { status?: string }
        if (data.status === 'succeeded') setStatus('paid')
        if (data.status === 'failed' || data.status === 'cancelled') {
          setStatus('failed')
        }
      } catch {
        /* keep polling */
      }
    }, 3000)
    return () => window.clearInterval(t)
  }, [checkout.paymentId, status])

  if (status === 'paid') {
    return (
      <>
        <CheckCircle2 size={56} className="text-turquoise-500 mb-3" />
        <h2 className="font-heading text-2xl mb-2">Payment confirmed!</h2>
        <p className="text-sm text-neutral-600 mb-5">
          Your {checkout.passName} is active. Scan your QR or search your name
          to check in.
        </p>
        <Button size="lg" onClick={() => window.location.assign('/checkin')}>
          Back to check-in
        </Button>
      </>
    )
  }

  return (
    <>
      <h2 className="font-heading text-xl mb-1">
        Pay {checkout.priceLabel} on your phone
      </h2>
      <p className="text-sm text-neutral-600 mb-4 max-w-sm">
        Scan this code with your phone&apos;s camera to pay securely with Wam.
        This screen updates the moment your payment goes through.
      </p>
      {qrSvg ? (
        <div
          className="bg-white p-3 rounded-lg border border-neutral-200 mb-4 [&_svg]:w-56 [&_svg]:h-56"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      ) : (
        <p className="text-sm text-neutral-500 mb-4">Preparing QR…</p>
      )}
      {status === 'failed' ? (
        <p className="text-sm text-red-700 mb-3">
          That payment didn&apos;t go through — try again or ask the team.
        </p>
      ) : (
        <p className="text-xs text-neutral-500 mb-3 inline-flex items-center gap-2">
          <span className="inline-block w-3.5 h-3.5 border-2 border-turquoise-200 border-t-turquoise-500 rounded-full animate-spin" />
          Waiting for payment… You can also pay cash at the front desk.
        </p>
      )}
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-neutral-600 underline"
      >
        Back to passes
      </button>
    </>
  )
}

function NeedsPayment({
  member,
  kind,
  title,
  body,
  lateBooking,
  lapsed = false,
}: {
  member: { id: string; fullName: string | null; email: string }
  kind: 'pt' | 'open_gym'
  title: string
  body: string
  lateBooking: { coachName: string; startLabel: string } | null
  lapsed?: boolean
}) {
  const [passes, setPasses] = useState<KioskPass[] | null>(null)
  const [buying, setBuying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [discountCode, setDiscountCode] = useState('')
  const [checkout, setCheckout] = useState<PendingCheckout | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/checkin/passes')
        if (!res.ok) return
        const data = (await res.json()) as { passes: KioskPass[] }
        if (!cancelled)
          setPasses(data.passes.filter((p) => p.sessionKind === kind))
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [kind])

  const buy = async (passId: string) => {
    setError(null)
    setBuying(passId)
    try {
      const res = await fetch('/api/checkin/buy-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.id,
          passId,
          ...(discountCode.trim() ? { discountCode: discountCode.trim() } : {}),
        }),
      })
      const data = (await res.json()) as {
        checkoutUrl?: string
        paymentId?: string
        error?: string
      }
      if (!res.ok || !data.checkoutUrl || !data.paymentId) {
        setError(humanError(data.error))
        setBuying(null)
        return
      }
      const pass = passes?.find((p) => p.id === passId)
      setCheckout({
        paymentId: data.paymentId,
        checkoutUrl: data.checkoutUrl,
        passName: pass?.name ?? 'pass',
        priceLabel: pass
          ? `${pass.currency} $${(pass.priceCents / 100).toLocaleString(
              'en-US',
              { maximumFractionDigits: 0 }
            )}`
          : '',
      })
      setBuying(null)
    } catch {
      setError('Network error. Try again.')
      setBuying(null)
    }
  }

  if (checkout) {
    return <PayByPhone checkout={checkout} onBack={() => setCheckout(null)} />
  }

  return (
    <>
      <AlertCircle size={48} className="text-orange-500 mb-3" />
      <h2 className="font-heading text-xl mb-2">{title}</h2>
      <p className="text-sm text-neutral-600 mb-2 max-w-sm">
        {(member.fullName ?? member.email).split(' ')[0]}, {body}
      </p>
      {lateBooking && (
        <p className="text-xs text-orange-700 mb-3 max-w-sm">
          Your PT with {lateBooking.coachName} at {lateBooking.startLabel} has
          passed its check-in window — ask {lateBooking.coachName} to confirm
          you in, or use open gym below.
        </p>
      )}
      <p className="text-xs text-neutral-500 mb-4">
        {lapsed
          ? 'Renew from your app, pay cash at the desk, or pick a pack to train today.'
          : 'Pay on your phone below, or cash at the desk.'}
      </p>

      {showCode ? (
        <input
          placeholder="Discount code"
          value={discountCode}
          onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
          maxLength={60}
          className="mb-4 h-11 w-full max-w-xs rounded-md border border-neutral-200 px-3 text-center text-sm uppercase"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowCode(true)}
          className="mb-4 text-xs text-turquoise-700 underline"
        >
          Have a discount code?
        </button>
      )}

      {passes === null ? (
        <p className="text-sm text-neutral-500">Loading options…</p>
      ) : passes.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No passes available. Please ask the manager.
        </p>
      ) : (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
          {passes.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={buying !== null}
              onClick={() => buy(p.id)}
              className="border border-neutral-200 rounded-lg p-4 text-left hover:border-turquoise-500 hover:bg-turquoise-50 transition disabled:opacity-50"
            >
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-neutral-500 mb-2">
                {p.usesTotal} use{p.usesTotal === 1 ? '' : 's'} · valid{' '}
                {p.validityDays} days
              </p>
              <p className="font-heading text-lg">
                {p.currency} $
                {(p.priceCents / 100).toLocaleString('en-US', {
                  maximumFractionDigits: 0,
                })}
              </p>
              {buying === p.id && (
                <p className="text-xs text-turquoise-700 mt-2">
                  Preparing payment…
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-700 mt-3">{error}</p>}
    </>
  )
}

function humanError(code: unknown): string {
  switch (code) {
    case 'invalid_qr':
      return 'That QR is expired or invalid. Refresh it from /my-qr and try again.'
    case 'unknown_member':
      return "We couldn't find a matching member."
    case 'kiosk_not_paired':
      return 'This tablet is no longer paired. Ask an admin to re-pair.'
    case 'pass_not_available':
      return 'No usable pass on file.'
    default:
      return 'Something went wrong. Try again or ask the manager.'
  }
}

function PinPad({
  label,
  error,
  onBack,
  onSubmit,
}: {
  label: string
  error?: string
  onBack: () => void
  onSubmit: (pin: string) => void
}) {
  const [pin, setPin] = useState('')
  const press = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) onSubmit(next)
  }
  return (
    <>
      <h2 className="font-heading text-2xl mb-1">Hi, {label.split(' ')[0]}</h2>
      <p className="text-sm text-neutral-600 mb-4">Enter your 4-digit PIN</p>
      <div className="flex gap-3 mb-5" aria-label="PIN entry">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={
              pin.length > i
                ? 'w-4 h-4 rounded-full bg-turquoise-500'
                : 'w-4 h-4 rounded-full border-2 border-neutral-300'
            }
          />
        ))}
      </div>
      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
      <div className="grid grid-cols-3 gap-3 w-64">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(
          (k, i) => (
            <button
              key={i}
              type="button"
              disabled={k === ''}
              onClick={() =>
                k === '⌫' ? setPin((p) => p.slice(0, -1)) : press(k)
              }
              className={
                k === ''
                  ? 'invisible'
                  : 'h-16 rounded-full bg-white border border-neutral-200 font-stat text-2xl hover:border-turquoise-500 active:bg-turquoise-50'
              }
            >
              {k}
            </button>
          )
        )}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="mt-5 text-sm text-neutral-600 underline"
      >
        Back
      </button>
    </>
  )
}
