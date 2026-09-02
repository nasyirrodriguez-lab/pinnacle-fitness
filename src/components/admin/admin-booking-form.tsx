'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { adminCreateBooking } from '@/app/admin/bookings/actions'
import { fmtAstTime, astTodayKey } from '@/lib/time/ast'
import { priceSlotsCents, rateForSlotCents } from '@/lib/booking/slots'

interface MemberOption {
  id: string
  label: string
  fullName: string
  email: string
}

interface ResourceOption {
  id: string
  name: string
  description: string | null
  kind: string
  capacity: number
  pricePerHourCents: number
  afterHoursPricePerHourCents: number | null
  afterHoursStartsAtHour: number | null
  adminOnly: boolean
  currency: string
  openHour: number
  closeHour: number
  slotMinutes: number
}

interface SlotCell {
  startIso: string
  endIso: string
  available: boolean
  bookedByMe: boolean
}

type Mode = 'member' | 'guest'
type PaymentStatus = 'paid' | 'unpaid' | 'plan'
type PaymentMethod = 'cash' | 'wam_pos' | 'bank_transfer' | 'other'

interface MemberCoverage {
  planHoursPerMonth: number
  planHoursUsed: number
  creditHours: number
}

function astHour(iso: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Port_of_Spain',
      hour: 'numeric',
      hour12: false,
    }).format(new Date(iso))
  )
}

interface Props {
  members: MemberOption[]
  resources: ResourceOption[]
  defaultUserId?: string
  defaultResourceId?: string
}

function fmtTtd(cents: number): string {
  return `TTD $${(cents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

export default function AdminBookingForm({
  members,
  resources,
  defaultUserId,
  defaultResourceId,
}: Props) {
  const [mode, setMode] = useState<Mode>('member')
  const [memberQuery, setMemberQuery] = useState('')
  const [userId, setUserId] = useState(defaultUserId ?? '')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')

  const [resourceId, setResourceId] = useState(
    defaultResourceId ?? resources[0]?.id ?? ''
  )
  const [date, setDate] = useState(astTodayKey())

  const [cells, setCells] = useState<SlotCell[]>([])
  const [isLoadingCells, startCellsLoad] = useTransition()
  const [cellsError, setCellsError] = useState<string | null>(null)
  const [memberCoverage, setMemberCoverage] = useState<MemberCoverage | null>(
    null
  )

  const [selectedStartIsos, setSelectedStartIsos] = useState<Set<string>>(
    new Set()
  )

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [externalRef, setExternalRef] = useState('')
  const [note, setNote] = useState('')
  const [groupSize, setGroupSize] = useState('')
  const [amountOverride, setAmountOverride] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const resource = useMemo(
    () => resources.find((r) => r.id === resourceId) ?? null,
    [resources, resourceId]
  )

  // Fetch the grid when (resource, date) changes. State writes are
  // wrapped in startCellsLoad so the project's setState-in-effect lint
  // rule is satisfied — the transition queues them as async work.
  const coverageMemberId = mode === 'member' ? userId : ''
  useEffect(() => {
    if (!resourceId || !date) return
    let cancelled = false
    startCellsLoad(async () => {
      try {
        const memberParam = coverageMemberId
          ? `&memberId=${encodeURIComponent(coverageMemberId)}`
          : ''
        const res = await fetch(
          `/api/admin/booking-availability?resourceId=${encodeURIComponent(
            resourceId
          )}&date=${encodeURIComponent(date)}${memberParam}`,
          { cache: 'no-store' }
        )
        const data = await res.json()
        if (cancelled) return
        if (data?.cells) {
          setCells(data.cells as SlotCell[])
          setMemberCoverage(
            (data.memberCoverage as MemberCoverage | null) ?? null
          )
          setCellsError(null)
        } else {
          setCellsError(data?.error ?? 'Could not load availability')
        }
      } catch {
        if (!cancelled) setCellsError('Network error loading availability')
      }
      if (!cancelled) setSelectedStartIsos(new Set())
    })
    return () => {
      cancelled = true
    }
  }, [resourceId, date, coverageMemberId])

  // Auto-priced total based on selected slots. Uses the same tier-aware
  // helper the server uses so override math always matches what's billed.
  const selectedCells = cells.filter((c) => selectedStartIsos.has(c.startIso))
  const resourceForPricing = resource
    ? {
        price_per_hour_cents: resource.pricePerHourCents,
        after_hours_price_per_hour_cents: resource.afterHoursPricePerHourCents,
        after_hours_starts_at_hour: resource.afterHoursStartsAtHour,
      }
    : null
  const autoCents = resourceForPricing
    ? priceSlotsCents(
        resourceForPricing,
        selectedCells.map((c) => ({ startIso: c.startIso, endIso: c.endIso }))
      )
    : 0

  // Per-slot rates so the slot buttons can show "after-hours" indication.
  const cellRates = new Map<string, number>()
  if (resourceForPricing) {
    for (const c of cells) {
      cellRates.set(
        c.startIso,
        rateForSlotCents(resourceForPricing, c.startIso)
      )
    }
  }
  const hasAfterHoursTier =
    resource?.afterHoursPricePerHourCents != null &&
    resource.afterHoursStartsAtHour != null &&
    resource.afterHoursPricePerHourCents !== resource.pricePerHourCents

  const overrideCents = (() => {
    const raw = amountOverride.trim()
    if (raw === '') return null
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return null
    return Math.round(n * 100)
  })()
  const effectiveCents = overrideCents ?? autoCents

  const filteredMembers = memberQuery.trim()
    ? members.filter((m) =>
        m.label.toLowerCase().includes(memberQuery.toLowerCase())
      )
    : members
  const selectedMember = members.find((m) => m.id === userId)

  const toggleSlot = (cell: SlotCell) => {
    if (!cell.available) return
    setSelectedStartIsos((prev) => {
      const next = new Set(prev)
      if (next.has(cell.startIso)) {
        next.delete(cell.startIso)
      } else {
        next.add(cell.startIso)
      }
      return next
    })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (mode === 'member') {
      if (!userId) {
        setError('Pick a member.')
        return
      }
    } else {
      if (!guestName.trim()) {
        setError('Guest name is required.')
        return
      }
      // Email is optional. Validate only if the admin filled it in.
      if (
        guestEmail.trim() &&
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail.trim())
      ) {
        setError('Enter a valid guest email or leave it blank.')
        return
      }
    }

    if (selectedCells.length === 0) {
      setError('Pick at least one time slot.')
      return
    }

    if (paymentStatus === 'paid' && !paymentMethod) {
      setError('Pick a payment method.')
      return
    }

    const slots = selectedCells.map((c) => ({
      startIso: c.startIso,
      endIso: c.endIso,
    }))

    const base = {
      resourceId,
      slots,
      paymentStatus,
      paymentMethod: paymentStatus === 'paid' ? paymentMethod : null,
      amountCentsOverride:
        paymentStatus === 'paid' && overrideCents !== null
          ? overrideCents
          : null,
      externalRef: externalRef.trim() || null,
      note: note.trim() || null,
      groupSize:
        groupSize.trim().length > 0 &&
        Number.isInteger(Number(groupSize)) &&
        Number(groupSize) >= 2
          ? Number(groupSize)
          : null,
    }

    startTransition(async () => {
      const input =
        mode === 'member'
          ? { ...base, mode: 'member' as const, userId }
          : {
              ...base,
              mode: 'guest' as const,
              guestName: guestName.trim(),
              guestEmail: guestEmail.trim(),
              guestPhone: guestPhone.trim() || null,
            }
      const result = await adminCreateBooking(input)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSuccess(
        `Booked ${result.bookingCount} slot${
          result.bookingCount === 1 ? '' : 's'
        }.`
      )
      setSelectedStartIsos(new Set())
      setNote('')
      setExternalRef('')
      setAmountOverride('')
      // Refetch the grid so just-booked slots show as busy.
      if (resourceId && date) {
        fetch(
          `/api/admin/booking-availability?resourceId=${encodeURIComponent(
            resourceId
          )}&date=${encodeURIComponent(date)}`,
          { cache: 'no-store' }
        )
          .then((r) => r.json())
          .then((data) => {
            if (data?.cells) setCells(data.cells as SlotCell[])
          })
          .catch(() => {})
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Mode toggle */}
      <div>
        <Label>Booking for</Label>
        <div className="mt-1 inline-flex gap-1 p-1 bg-neutral-100 rounded-md">
          <button
            type="button"
            onClick={() => setMode('member')}
            className={
              mode === 'member'
                ? 'px-3 py-1.5 text-sm font-medium bg-white text-neutral-900 shadow-sm rounded'
                : 'px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 rounded'
            }
          >
            A member
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('guest')
              setPaymentStatus((s) => (s === 'plan' ? 'unpaid' : s))
            }}
            className={
              mode === 'guest'
                ? 'px-3 py-1.5 text-sm font-medium bg-white text-neutral-900 shadow-sm rounded'
                : 'px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 rounded'
            }
          >
            A guest (not on the platform)
          </button>
        </div>
      </div>

      {mode === 'member' ? (
        <div>
          <Label>Member</Label>
          <Input
            placeholder="Search by name or email"
            value={memberQuery}
            onChange={(e) => setMemberQuery(e.target.value)}
            className="mb-2"
          />
          <div className="max-h-48 overflow-y-auto border border-neutral-200 rounded-md divide-y divide-neutral-100">
            {filteredMembers.slice(0, 50).map((m) => (
              <label
                key={m.id}
                className={
                  userId === m.id
                    ? 'flex items-center gap-2 px-3 py-2 bg-turquoise-50 cursor-pointer'
                    : 'flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 cursor-pointer'
                }
              >
                <input
                  type="radio"
                  name="userId"
                  value={m.id}
                  checked={userId === m.id}
                  onChange={() => setUserId(m.id)}
                  className="shrink-0"
                />
                <span className="text-sm truncate">{m.label}</span>
              </label>
            ))}
            {filteredMembers.length === 0 && (
              <p className="px-3 py-3 text-sm text-neutral-500">
                No members match.
              </p>
            )}
          </div>
          {selectedMember && (
            <p className="text-xs text-neutral-500 mt-1">
              Selected: <strong>{selectedMember.label}</strong>
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="guestName">Guest name</Label>
            <Input
              id="guestName"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Jane Doe"
              required
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="guestEmail">Guest email (optional)</Label>
            <Input
              id="guestEmail"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="jane@example.com"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Leave blank if the guest didn&apos;t provide one.
            </p>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="guestPhone">Guest phone (optional)</Label>
            <Input
              id="guestPhone"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+1 868…"
              maxLength={40}
            />
          </div>
        </div>
      )}

      {/* Resource + date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="resourceId">Meeting space</Label>
          <Select value={resourceId} onValueChange={setResourceId}>
            <SelectTrigger id="resourceId">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resources.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                  {r.pricePerHourCents > 0 &&
                    ` · ${fmtTtd(r.pricePerHourCents)}/hr`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {resource && (
            <p className="text-xs text-neutral-500 mt-1">
              {resource.description ??
                `Capacity ${resource.capacity} · ${resource.slotMinutes}-min slots`}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="date">Date (AST)</Label>
          <Input
            id="date"
            type="date"
            value={date}
            min={astTodayKey()}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Slot grid */}
      <div>
        <Label>Time slots</Label>
        {isLoadingCells && (
          <p className="text-sm text-neutral-500">Loading availability…</p>
        )}
        {cellsError && (
          <Alert variant="destructive">
            <AlertDescription>{cellsError}</AlertDescription>
          </Alert>
        )}
        {!isLoadingCells && !cellsError && cells.length === 0 && (
          <p className="text-sm text-neutral-500">No slots for this date.</p>
        )}
        {!isLoadingCells && cells.length > 0 && (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {cells.map((cell) => {
                const selected = selectedStartIsos.has(cell.startIso)
                const slotRate = cellRates.get(cell.startIso) ?? 0
                // 5pm onward is after-hours whether or not the resource
                // charges a premium for it.
                const isAfterHours =
                  astHour(cell.startIso) >=
                  (resource?.afterHoursStartsAtHour ?? 17)
                const baseClass = !cell.available
                  ? 'px-2 py-2 text-xs rounded-md border border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed'
                  : selected
                    ? 'px-2 py-2 text-xs rounded-md border-2 border-turquoise-500 bg-turquoise-50 text-turquoise-900 font-medium'
                    : 'px-2 py-2 text-xs rounded-md border border-neutral-300 hover:border-turquoise-400 hover:bg-turquoise-50/50'
                return (
                  <button
                    key={cell.startIso}
                    type="button"
                    disabled={!cell.available}
                    onClick={() => toggleSlot(cell)}
                    className={baseClass}
                    title={
                      cell.available
                        ? `${fmtAstTime(cell.startIso)} – ${fmtAstTime(cell.endIso)} · ${fmtTtd(slotRate)}/hr${isAfterHours ? ' (after-hours)' : ''}`
                        : 'Already booked'
                    }
                  >
                    <span className="block">{fmtAstTime(cell.startIso)}</span>
                    {isAfterHours && cell.available && (
                      <span className="block text-[10px] mt-0.5 text-orange-700">
                        after-hours
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              {selectedCells.length === 0
                ? 'Tap one or more slots.'
                : `${selectedCells.length} slot${
                    selectedCells.length === 1 ? '' : 's'
                  } selected · Auto-priced ${fmtTtd(autoCents)}`}
            </p>
            {hasAfterHoursTier && (
              <p className="text-[11px] text-neutral-500 mt-1">
                Regular {fmtTtd(resource?.pricePerHourCents ?? 0)}/hr ·
                After-hours {fmtTtd(resource?.afterHoursPricePerHourCents ?? 0)}
                /hr from {(resource?.afterHoursStartsAtHour ?? 0) % 12 || 12}
                {(resource?.afterHoursStartsAtHour ?? 0) >= 12 ? 'pm' : 'am'}
              </p>
            )}
          </>
        )}
      </div>

      {/* Payment */}
      <div className="border-t border-neutral-100 pt-4">
        <Label>Payment</Label>
        <div className="mt-1 inline-flex gap-1 p-1 bg-neutral-100 rounded-md">
          <button
            type="button"
            onClick={() => setPaymentStatus('unpaid')}
            className={
              paymentStatus === 'unpaid'
                ? 'px-3 py-1.5 text-sm font-medium bg-white shadow-sm rounded'
                : 'px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 rounded'
            }
          >
            Unpaid (invoice later)
          </button>
          <button
            type="button"
            onClick={() => setPaymentStatus('paid')}
            className={
              paymentStatus === 'paid'
                ? 'px-3 py-1.5 text-sm font-medium bg-white shadow-sm rounded'
                : 'px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 rounded'
            }
          >
            Paid now
          </button>
          {mode === 'member' && (
            <button
              type="button"
              onClick={() => setPaymentStatus('plan')}
              className={
                paymentStatus === 'plan'
                  ? 'px-3 py-1.5 text-sm font-medium bg-white shadow-sm rounded'
                  : 'px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 rounded'
              }
            >
              From plan / credits
            </button>
          )}
        </div>

        {paymentStatus === 'plan' && mode === 'member' && (
          <div className="mt-3 text-sm bg-turquoise-50 border border-turquoise-200 rounded-md p-3">
            {!userId ? (
              <p className="text-neutral-700">
                Pick a member above to see their plan hours and credits.
              </p>
            ) : memberCoverage ? (
              <>
                <p className="text-neutral-800">
                  {memberCoverage.planHoursPerMonth > 0 ? (
                    <>
                      Plan includes{' '}
                      <strong>
                        {memberCoverage.planHoursPerMonth >= 100000
                          ? 'unlimited'
                          : `${memberCoverage.planHoursPerMonth}h/month`}
                      </strong>{' '}
                      on this room · {memberCoverage.planHoursUsed}h used this
                      month
                    </>
                  ) : (
                    <>No plan hours on this room</>
                  )}
                  {' · '}
                  <strong>{memberCoverage.creditHours}h</strong> meeting credits
                </p>
                <p className="text-xs text-neutral-600 mt-1">
                  The booking must be fully covered by plan hours + credits —
                  otherwise switch to Paid or Unpaid.
                </p>
              </>
            ) : (
              <p className="text-neutral-700">Loading member allowances…</p>
            )}
          </div>
        )}

        {paymentStatus === 'paid' && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="paymentMethod">Payment method</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                >
                  <SelectTrigger id="paymentMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="wam_pos">Wam POS (card)</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amountOverride">
                  Amount (TTD) — auto-priced {fmtTtd(autoCents)}
                </Label>
                <Input
                  id="amountOverride"
                  inputMode="decimal"
                  placeholder={(autoCents / 100).toFixed(0)}
                  value={amountOverride}
                  onChange={(e) => setAmountOverride(e.target.value)}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Leave blank to use the auto-priced amount.
                </p>
              </div>
            </div>

            {paymentMethod === 'wam_pos' && (
              <div>
                <Label htmlFor="externalRef">Wam reference (optional)</Label>
                <Input
                  id="externalRef"
                  value={externalRef}
                  onChange={(e) => setExternalRef(e.target.value)}
                  placeholder="e.g. 7792104800646399603862"
                />
              </div>
            )}

            <p className="text-xs text-neutral-700">
              Charging <strong>{fmtTtd(effectiveCents)}</strong>
              {overrideCents !== null && overrideCents !== autoCents && (
                <> · override of auto-priced {fmtTtd(autoCents)}</>
              )}
            </p>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="groupSize">Group booking (optional)</Label>
        <Input
          id="groupSize"
          type="number"
          min={2}
          max={50}
          placeholder="Number of people — e.g. 5 for a team booking"
          value={groupSize}
          onChange={(e) => setGroupSize(e.target.value)}
          disabled={isPending}
        />
        <p className="text-xs text-neutral-500 -mt-1 mb-2">
          Set this and the kiosk lets each person check in against this booking
          until everyone&apos;s in.
        </p>

        <Label htmlFor="note">Internal note (optional)</Label>
        <Textarea
          id="note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything worth remembering about this booking"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Confirm booking'}
        </Button>
        <p className="text-xs text-neutral-500">
          Saved as <strong>confirmed</strong> immediately.
        </p>
      </div>
    </form>
  )
}
