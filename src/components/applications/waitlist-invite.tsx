'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { inviteFromWaitlist } from '@/app/admin/applications/actions'

// Slow month? Open the list and invite the next few, oldest first.
// Each gets a 7-day pay link; unpaid invites roll back to the list.
export default function WaitlistInvite({ waiting }: { waiting: number }) {
  const router = useRouter()
  const [count, setCount] = useState(3)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  if (waiting === 0) return null
  return (
    <div className="rounded-card bg-card border border-border p-5 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-48">
        <p className="font-heading text-lg">
          <span className="font-stat text-2xl text-primary">{waiting}</span> on
          the waitlist
        </p>
        <p className="text-sm text-muted-foreground">
          Invite the next few — oldest first, 7-day pay links.
        </p>
      </div>
      <input
        type="number"
        min={1}
        max={Math.min(50, waiting)}
        value={count}
        onChange={(e) => setCount(Number(e.target.value) || 1)}
        className="h-10 w-20 rounded-full border border-border bg-background px-3 text-center font-stat"
      />
      <Button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await inviteFromWaitlist({ count })
            setNotice(
              r.ok ? `Invited ${r.invited} — links expire in 7 days.` : r.error
            )
            router.refresh()
          })
        }
      >
        {isPending ? 'Inviting…' : `Invite ${count}`}
      </Button>
      {notice && (
        <p className="w-full text-sm text-muted-foreground">{notice}</p>
      )}
    </div>
  )
}
