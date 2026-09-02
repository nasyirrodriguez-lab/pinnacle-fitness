'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { coachSaveAvailability, coachAddBlock, coachRemoveBlock } from '@/app/coach/actions'
import { fmtAstDateTime } from '@/lib/time/ast'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface WindowRow { weekday: number; startMinute: number; endMinute: number }
export interface BlockRow { id: string; startsAt: string; endsAt: string; reason: string | null }

function toTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
function toMinute(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export default function CoachAvailabilityEditor({ windows, blocks }: { windows: WindowRow[]; blocks: BlockRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState<WindowRow[]>(windows)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [blockReason, setBlockReason] = useState('')

  const update = (i: number, patch: Partial<WindowRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-6">
      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h2 className="font-heading text-lg mb-1">Weekly hours</h2>
        <p className="text-xs text-neutral-500 mb-4">Members can book you in 60-minute slots inside these windows.</p>
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <select
                value={r.weekday}
                onChange={(e) => update(i, { weekday: Number(e.target.value) })}
                className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm"
              >
                {DAYS.map((d, wd) => (
                  <option key={wd} value={wd}>{d}</option>
                ))}
              </select>
              <Input type="time" value={toTime(r.startMinute)} onChange={(e) => update(i, { startMinute: toMinute(e.target.value) })} className="w-32" />
              <span className="text-neutral-500 text-sm">to</span>
              <Input type="time" value={toTime(r.endMinute)} onChange={(e) => update(i, { endMinute: toMinute(e.target.value) })} className="w-32" />
              <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="text-xs text-neutral-500 hover:text-red-700">
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, { weekday: 1, startMinute: 330, endMinute: 1140 }])}
            className="text-sm text-turquoise-700 hover:underline"
          >
            + Add a window
          </button>
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setError(null)
              setSaved(false)
              startTransition(async () => {
                const r = await coachSaveAvailability({ windows: rows })
                if (!r.ok) { setError(r.error); return }
                setSaved(true)
                router.refresh()
              })
            }}
          >
            {isPending ? 'Saving…' : 'Save hours'}
          </Button>
          {saved && <span className="text-sm text-turquoise-700">Saved</span>}
        </div>
        {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h2 className="font-heading text-lg mb-1">Time off</h2>
        <p className="text-xs text-neutral-500 mb-4">Block a day or a few hours — nobody can book you inside a block.</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <label className="text-xs text-neutral-500">From<Input type="datetime-local" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} /></label>
          <label className="text-xs text-neutral-500">To<Input type="datetime-local" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} /></label>
          <label className="text-xs text-neutral-500">Reason<Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Away" maxLength={120} /></label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending || !blockStart || !blockEnd}
            onClick={() =>
              startTransition(async () => {
                const r = await coachAddBlock({
                  startsAt: new Date(blockStart).toISOString(),
                  endsAt: new Date(blockEnd).toISOString(),
                  reason: blockReason,
                })
                if (!r.ok) { setError(r.error); return }
                setBlockStart(''); setBlockEnd(''); setBlockReason('')
                router.refresh()
              })
            }
          >
            Add block
          </Button>
        </div>
        {blocks.length > 0 && (
          <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
            {blocks.map((b) => (
              <li key={b.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span>
                  {fmtAstDateTime(b.startsAt)} → {fmtAstDateTime(b.endsAt)}
                  {b.reason && <span className="text-neutral-500"> · {b.reason}</span>}
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(async () => { const r = await coachRemoveBlock({ blockId: b.id }); if (!r.ok) setError(r.error); else router.refresh() })}
                  className="text-xs text-neutral-500 hover:text-red-700"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
