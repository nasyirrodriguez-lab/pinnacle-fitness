'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  adminAdjustSessions,
  adminUpdateGymProfile,
} from '@/app/admin/members/[id]/actions'
import type { LedgerEntry } from '@/lib/sessions/ledger'
import { fmtAstDate } from '@/lib/time/ast'

const REASON_LABEL: Record<string, string> = {
  plan_grant: 'Plan month',
  pack_purchase: 'Pack bought',
  booking_use: 'Session delivered',
  checkin_use: 'Checked in',
  no_show: 'No-show',
  late_cancel: 'Late cancel',
  refund: 'Refund',
  expiry: 'Expired',
  admin_adjust: 'Adjusted by team',
}

export default function AdminSessionsCard({
  userId,
  ptBalance,
  openGymBalance,
  ledger,
  gym,
  coaches,
}: {
  userId: string
  ptBalance: number
  openGymBalance: number
  ledger: LedgerEntry[]
  gym: {
    pinSet: boolean
    preferredCoachId: string | null
    trainingNotes: string | null
    goal: string | null
    experienceBracket: string | null
  }
  coaches: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<'pt' | 'open_gym'>('pt')
  const [delta, setDelta] = useState('')
  const [note, setNote] = useState('')
  const [pin, setPin] = useState('')
  const [coachId, setCoachId] = useState(gym.preferredCoachId ?? '')
  const [goal, setGoal] = useState(gym.goal ?? '')
  const [notes, setNotes] = useState(gym.trainingNotes ?? '')
  const [bracket, setBracket] = useState(gym.experienceBracket ?? '')
  const [saved, setSaved] = useState(false)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-turquoise-500 text-black rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide opacity-70">PT sessions</p>
          <p className="font-stat text-4xl">{ptBalance}</p>
        </div>
        <div className="bg-neutral-100 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Open-gym visits</p>
          <p className="font-stat text-4xl">{openGymBalance}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="inline-flex p-1 rounded-full bg-neutral-100">
          {(['pt', 'open_gym'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={
                kind === k
                  ? 'px-3 py-1 text-xs font-semibold rounded-full bg-white shadow-sm'
                  : 'px-3 py-1 text-xs font-semibold rounded-full text-neutral-600'
              }
            >
              {k === 'pt' ? 'PT' : 'Open gym'}
            </button>
          ))}
        </div>
        <Input
          type="number"
          placeholder="+2 or -1"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          className="w-24 h-9"
        />
        <Input
          placeholder="Why (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-44 h-9"
          maxLength={200}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || !Number.isInteger(Number(delta)) || Number(delta) === 0}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              const r = await adminAdjustSessions({ userId, kind, delta: Number(delta), note })
              if (!r.ok) { setError(r.error); return }
              setDelta(''); setNote('')
              router.refresh()
            })
          }}
        >
          Adjust
        </Button>
      </div>

      {ledger.length > 0 && (
        <details>
          <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-900">History</summary>
          <ul className="mt-2 divide-y divide-neutral-100 text-xs">
            {ledger.map((e) => (
              <li key={e.id} className="py-1.5 flex items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{e.kind === 'pt' ? 'PT' : 'Open gym'}</span> · {REASON_LABEL[e.reason] ?? e.reason}
                  <span className="text-neutral-500"> · {fmtAstDate(e.createdAt)}</span>
                </span>
                <span className={e.delta > 0 ? 'font-stat text-turquoise-700' : 'font-stat text-neutral-600'}>
                  {e.delta > 0 ? '+' : ''}{e.delta} → {e.balanceAfter}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="border-t border-neutral-100 pt-4 space-y-3">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Coaching profile</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-neutral-500">
            Preferred coach
            <select value={coachId} onChange={(e) => setCoachId(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm">
              <option value="">No preference</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-500">
            Experience
            <select value={bracket} onChange={(e) => setBracket(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm">
              <option value="">Unknown</option>
              <option value="under_6m">Under 6 months</option>
              <option value="6_24m">6–24 months</option>
              <option value="2y_plus">2+ years</option>
            </select>
          </label>
          <label className="text-xs text-neutral-500 sm:col-span-2">
            Goal
            <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Strength for football season" maxLength={200} className="mt-1" />
          </label>
          <label className="text-xs text-neutral-500 sm:col-span-2">
            Notes for the coach (injuries, limits)
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className="mt-1" />
          </label>
          <label className="text-xs text-neutral-500">
            Kiosk PIN {gym.pinSet ? '(set)' : '(not set)'}
            <Input inputMode="numeric" maxLength={4} placeholder="New 4-digit PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-1" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setError(null); setSaved(false)
              startTransition(async () => {
                const r = await adminUpdateGymProfile({
                  userId,
                  pinCode: pin || undefined,
                  preferredCoachId: coachId || null,
                  goal,
                  trainingNotes: notes,
                  experienceBracket: (bracket || null) as 'under_6m' | '6_24m' | '2y_plus' | null,
                })
                if (!r.ok) { setError(r.error); return }
                setPin(''); setSaved(true)
                router.refresh()
              })
            }}
          >
            Save profile
          </Button>
          {gym.pinSet && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(async () => {
                const r = await adminUpdateGymProfile({ userId, clearPin: true, preferredCoachId: coachId || null, goal, trainingNotes: notes, experienceBracket: (bracket || null) as 'under_6m' | '6_24m' | '2y_plus' | null })
                if (!r.ok) setError(r.error); else router.refresh()
              })}
              className="text-xs text-neutral-500 hover:text-red-700"
            >
              Clear PIN
            </button>
          )}
          {saved && <span className="text-sm text-turquoise-700">Saved</span>}
        </div>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  )
}
