'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  adminGrantRoomHours,
  adminRevokeRoomHours,
} from '@/app/admin/members/[id]/actions'

export interface RoomCreditRow {
  id: string
  resourceName: string
  hoursGranted: number
  hoursUsed: number
  expiresAt: string | null
  reason: string | null
}

interface Props {
  userId: string
  credits: RoomCreditRow[]
  resources: { id: string; name: string }[]
}

// Grant free room hours ("5 hours on the Conference Room") and see
// what's left on each grant. Bookings consume these automatically.
export default function AdminRoomCreditsCard({
  userId,
  credits,
  resources,
}: Props) {
  const router = useRouter()
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? '')
  const [hours, setHours] = useState('')
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const grant = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await adminGrantRoomHours({
        userId,
        resourceId,
        hours: Number.parseFloat(hours),
        reason: reason.trim() || undefined,
        expiresAt: expiresAt || null,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setHours('')
      setReason('')
      setExpiresAt('')
      router.refresh()
    })
  }

  const revoke = (creditId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await adminRevokeRoomHours({ userId, creditId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  const parsedHours = Number.parseFloat(hours)

  return (
    <div className="space-y-4">
      {credits.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No room hours granted. Bookings on a granted room come free until the
          hours run out.
        </p>
      ) : (
        <ul className="space-y-2">
          {credits.map((c) => {
            const remaining = c.hoursGranted - c.hoursUsed
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 text-sm py-2 border-b border-neutral-100 last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {c.resourceName} ·{' '}
                    <span
                      className={
                        remaining > 0
                          ? 'text-turquoise-700'
                          : 'text-neutral-500'
                      }
                    >
                      {remaining} of {c.hoursGranted} hrs left
                    </span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    {c.reason ?? 'Granted by admin'}
                    {c.expiresAt && ` · expires ${c.expiresAt.slice(0, 10)}`}
                  </p>
                </div>
                {remaining > 0 && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => revoke(c.id)}
                    className="p-1.5 rounded-full text-neutral-400 hover:text-red-700 hover:bg-neutral-100 shrink-0"
                    aria-label="Revoke remaining hours"
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <form onSubmit={grant} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={resourceId}
            onValueChange={setResourceId}
            disabled={isPending}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Room" />
            </SelectTrigger>
            <SelectContent>
              {resources.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0.5}
            step={0.5}
            placeholder="Hours"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            disabled={isPending}
            className="h-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isPending}
            maxLength={200}
            className="h-9"
          />
          <Input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            disabled={isPending}
            className="h-9"
          />
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <Button
          type="submit"
          size="sm"
          disabled={
            isPending ||
            !resourceId ||
            !Number.isFinite(parsedHours) ||
            parsedHours <= 0
          }
        >
          {isPending ? 'Granting…' : 'Grant hours'}
        </Button>
      </form>
    </div>
  )
}
