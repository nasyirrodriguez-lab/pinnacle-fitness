'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { adminCreateBooking } from '@/app/admin/bookings/actions'
import { fmtAstTime, fmtAstWeekdayDate } from '@/lib/time/ast'

interface Slot {
  startIso: string
  endIso: string
  booked: number
  capacity: number
  available: boolean
  isFull: boolean
  isPast: boolean
}

interface Props {
  members: { id: string; label: string }[]
  coaches: { id: string; name: string; capacity: number }[]
  defaultUserId?: string
  defaultResourceId?: string
}

export default function AdminBookingForm({ members, coaches, defaultUserId, defaultResourceId }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [userId, setUserId] = useState(defaultUserId ?? '')
  const [resourceId, setResourceId] = useState(defaultResourceId ?? coaches[0]?.id ?? '')
  const [days, setDays] = useState<{ dateKey: string; slots: Slot[] }[]>([])
  const [dayKey, setDayKey] = useState<string>('')
  const [startIso, setStartIso] = useState('')
  const [member, setMember] = useState<{ ptBalance: number; ptUnlimited: boolean; plan: string | null } | null>(null)
  const [override, setOverride] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loading, startLoad] = useTransition()

  useEffect(() => {
    if (!resourceId) return
    let cancelled = false
    startLoad(async () => {
      const res = await fetch(`/api/admin/booking-availability?resourceId=${encodeURIComponent(resourceId)}${userId ? `&memberId=${userId}` : ''}`, { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (cancelled || !data?.days) return
      setDays(data.days)
      setMember(data.member ?? null)
      setDayKey((k) => (data.days.some((d: { dateKey: string }) => d.dateKey === k) ? k : (data.days[0]?.dateKey ?? '')))
      setStartIso('')
    })
    return () => { cancelled = true }
  }, [resourceId, userId])

  const filtered = query.trim() ? members.filter((m) => m.label.toLowerCase().includes(query.toLowerCase())) : members
  const slots = days.find((d) => d.dateKey === dayKey)?.slots ?? []
  const noBalance = member !== null && !member.ptUnlimited && member.ptBalance <= 0

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null); setSuccess(null)
        if (!userId) return setError('Pick a member.')
        if (!startIso) return setError('Pick an hour.')
        startTransition(async () => {
          const r = await adminCreateBooking({ userId, resourceId, startIso, overrideNoSessions: override, note: note || null })
          if (!r.ok) {
            if (r.code === 'no_sessions') setOverride(true)
            setError(r.error)
            return
          }
          setSuccess(`Booked: ${r.label}`)
          setStartIso('')
          router.refresh()
        })
      }}
    >
      <div>
        <Label>Member</Label>
        <Input placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-2" />
        <div className="max-h-44 overflow-y-auto border border-neutral-200 rounded-md divide-y divide-neutral-100">
          {filtered.slice(0, 50).map((m) => (
            <label key={m.id} className={userId === m.id ? 'flex items-center gap-2 px-3 py-2 bg-turquoise-50 cursor-pointer' : 'flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 cursor-pointer'}>
              <input type="radio" name="userId" value={m.id} checked={userId === m.id} onChange={() => setUserId(m.id)} />
              <span className="text-sm truncate">{m.label}</span>
            </label>
          ))}
          {filtered.length === 0 && <p className="px-3 py-3 text-sm text-neutral-500">No members match.</p>}
        </div>
        {member && (
          <p className={noBalance ? 'text-xs text-orange-700 mt-1' : 'text-xs text-neutral-500 mt-1'}>
            {member.plan ?? 'No plan'} · {member.ptUnlimited ? 'unlimited PT' : `${member.ptBalance} PT session${member.ptBalance === 1 ? '' : 's'} left`}
            {noBalance && ' — no balance: booking will need a top-up at check-in'}
          </p>
        )}
      </div>

      <div>
        <Label>Coach</Label>
        <div className="mt-1 inline-flex gap-1 p-1 bg-neutral-100 rounded-full">
          {coaches.map((c) => (
            <button key={c.id} type="button" onClick={() => setResourceId(c.id)} className={resourceId === c.id ? 'px-3 py-1.5 text-sm font-medium bg-white shadow-sm rounded-full' : 'px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 rounded-full'}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Day</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          {days.map((d) => {
            const open = d.slots.filter((s) => s.available).length
            return (
              <button key={d.dateKey} type="button" disabled={open === 0} onClick={() => { setDayKey(d.dateKey); setStartIso('') }}
                className={dayKey === d.dateKey ? 'px-3 py-1.5 text-xs font-semibold rounded-full bg-turquoise-500 text-black' : open === 0 ? 'px-3 py-1.5 text-xs rounded-full border border-neutral-200 text-neutral-400' : 'px-3 py-1.5 text-xs rounded-full border border-neutral-300 hover:border-turquoise-500'}>
                {fmtAstWeekdayDate(`${d.dateKey}T12:00:00-04:00`)}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <Label>Hour</Label>
        {loading && <p className="text-sm text-neutral-500">Loading…</p>}
        <div className="mt-1 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {slots.map((s) => (
            <button key={s.startIso} type="button" disabled={!s.available} onClick={() => setStartIso(s.startIso)}
              className={startIso === s.startIso ? 'px-2 py-2 text-xs rounded-full border-2 border-turquoise-500 bg-turquoise-50 font-semibold' : !s.available ? 'px-2 py-2 text-xs rounded-full border border-neutral-200 text-neutral-400' : 'px-2 py-2 text-xs rounded-full border border-neutral-300 hover:border-turquoise-500'}>
              {fmtAstTime(s.startIso)}
              <span className="block text-[10px] text-neutral-500">{s.booked}/{s.capacity}</span>
            </button>
          ))}
          {!loading && slots.length === 0 && <p className="col-span-full text-sm text-neutral-500">No hours open that day.</p>}
        </div>
      </div>

      {noBalance && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
          Book anyway — coach&apos;s call. They&apos;ll be asked to top up when they scan in.
        </label>
      )}

      <div>
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert><AlertDescription>{success}</AlertDescription></Alert>}
      <Button type="submit" disabled={isPending}>{isPending ? 'Booking…' : 'Confirm booking'}</Button>
    </form>
  )
}
