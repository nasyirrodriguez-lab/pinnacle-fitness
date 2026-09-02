'use client'

import { useState, useTransition } from 'react'
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react'
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
import { adminUpdateBooking } from '@/app/admin/bookings/actions'
import { astDateKey, fmtAstDateTime } from '@/lib/time/ast'

interface ResourceOption {
  id: string
  name: string
  pricePerHourCents: number
  afterHoursPricePerHourCents: number | null
  afterHoursStartsAtHour: number | null
  slotMinutes: number
  openHour: number
  closeHour: number
}

interface BookingDetail {
  id: string
  startIso: string
  endIso: string
  status: string
  priceCents: number
  resourceId: string
  resourceName: string
  notes: string | null
  userId: string | null
  userFullName: string | null
  userEmail: string | null
  guestName: string | null
  guestEmail: string | null
  guestPhone: string | null
  createdAt: string
}

interface Props {
  booking: BookingDetail
  resources: ResourceOption[]
}

// Build an ISO with the AST offset given a YYYY-MM-DD and a HH:mm.
function astIso(dateKey: string, time: string): string {
  return `${dateKey}T${time}:00-04:00`
}

// Extract HH:mm in AST from an ISO string.
function toAstHm(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'America/Port_of_Spain',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function fmtTtd(cents: number): string {
  return `TTD $${(cents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

export default function AdminBookingEditor({ booking, resources }: Props) {
  const [resourceId, setResourceId] = useState(booking.resourceId)
  const [dateKey, setDateKey] = useState(astDateKey(booking.startIso))
  const [startTime, setStartTime] = useState(toAstHm(booking.startIso))
  const [endTime, setEndTime] = useState(toAstHm(booking.endIso))
  const [priceTtd, setPriceTtd] = useState(
    (booking.priceCents / 100).toFixed(0)
  )
  const [notes, setNotes] = useState(booking.notes ?? '')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const resourceChanged = resourceId !== booking.resourceId
  const dateChanged = dateKey !== astDateKey(booking.startIso)
  const startChanged = startTime !== toAstHm(booking.startIso)
  const endChanged = endTime !== toAstHm(booking.endIso)
  const timeChanged = dateChanged || startChanged || endChanged
  const priceChanged = Math.round(Number(priceTtd) * 100) !== booking.priceCents
  const notesChanged = (notes ?? '') !== (booking.notes ?? '')
  const anyChange =
    resourceChanged || timeChanged || priceChanged || notesChanged

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!anyChange) {
      setError('Nothing changed.')
      return
    }

    const updates: Parameters<typeof adminUpdateBooking>[0] = {
      bookingId: booking.id,
    }

    if (resourceChanged) updates.resourceId = resourceId
    if (timeChanged) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ||
        !/^\d{2}:\d{2}$/.test(startTime) ||
        !/^\d{2}:\d{2}$/.test(endTime)
      ) {
        setError('Date and time must be filled.')
        return
      }
      const startIso = astIso(dateKey, startTime)
      const endIso = astIso(dateKey, endTime)
      if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        setError('End must be after start.')
        return
      }
      updates.startIso = startIso
      updates.endIso = endIso
    }
    if (priceChanged) {
      const n = Number(priceTtd)
      if (!Number.isFinite(n) || n < 0) {
        setError('Price must be a non-negative number.')
        return
      }
      updates.priceCents = Math.round(n * 100)
    }
    if (notesChanged) {
      updates.notes = notes.trim() ? notes.trim() : null
    }

    startTransition(async () => {
      const res = await adminUpdateBooking(updates)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSuccess('Saved.')
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="resource">Room / space</Label>
          <Select value={resourceId} onValueChange={setResourceId}>
            <SelectTrigger id="resource">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resources.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {resourceChanged && (
            <p className="text-xs text-orange-700 mt-1">
              Was: {booking.resourceName}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="date">Date (AST)</Label>
          <Input
            id="date"
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
          />
          {dateChanged && (
            <p className="text-xs text-orange-700 mt-1">
              Was: {fmtAstDateTime(booking.startIso)}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="start">Start (AST)</Label>
          <Input
            id="start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="end">End (AST)</Label>
          <Input
            id="end"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="price">Price (TTD)</Label>
          <Input
            id="price"
            inputMode="decimal"
            value={priceTtd}
            onChange={(e) => setPriceTtd(e.target.value)}
          />
          {priceChanged && (
            <p className="text-xs text-orange-700 mt-1">
              Was: {fmtTtd(booking.priceCents)}
            </p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Internal notes</Label>
        <Textarea
          id="notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything worth remembering about this booking (only visible to admin)."
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle size={16} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <CheckCircle2 size={16} />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3 border-t border-neutral-100 pt-4">
        <Button type="submit" disabled={isPending || !anyChange}>
          <Save size={14} className="mr-2" />
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
        <p className="text-xs text-neutral-500">
          Conflicts with another booking at the new room/time will be blocked.
        </p>
      </div>
    </form>
  )
}
