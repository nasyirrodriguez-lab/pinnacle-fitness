'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminSaveGymSettings } from '@/app/admin/settings/actions'
import type { GymSettings } from '@/lib/gym/settings'

const FIELDS: { key: keyof GymSettings; label: string; help: string; money?: boolean }[] = [
  { key: 'floorCap', label: 'Floor cap', help: 'People on the turf at once. The iPad stops admitting at this number.' },
  { key: 'autoSignoutHours', label: 'Auto sign-out (hours)', help: 'Anyone still "in" this long after scanning is signed out automatically.' },
  { key: 'ptCancelHours', label: 'Free cancel window (hours)', help: 'Cancel a PT slot earlier than this and nothing is spent.' },
  { key: 'noShowMinutes', label: 'No-show after (minutes)', help: 'Minutes past the slot start before an un-scanned booking is charged.' },
  { key: 'checkinEarlyMinutes', label: 'Check-in opens (minutes before)', help: 'How early a PT booking can scan in.' },
  { key: 'checkinLateMinutes', label: 'Check-in closes (minutes after)', help: 'How late a scan still matches the booking.' },
  { key: 'lapseGraceDays', label: 'Renewal grace (days)', help: 'Days past renewal a member can still train before the door says no.' },
  { key: 'rentTargetCents', label: 'Monthly rent target (TT$)', help: 'What the pool needs to cover each month. 0 = not tracked.', money: true },
]

export default function GymSettingsForm({ settings }: { settings: GymSettings }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<keyof GymSettings, string>>(() => {
    const out = {} as Record<keyof GymSettings, string>
    for (const f of FIELDS) out[f.key] = f.money ? String(settings[f.key] / 100) : String(settings[f.key])
    return out
  })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-sm font-medium">{f.label}</span>
            <Input type="number" min={0} value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className="mt-1 font-stat text-lg" />
            <span className="block text-xs text-neutral-500 mt-1">{f.help}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null); setSaved(false)
            startTransition(async () => {
              const payload = {} as GymSettings
              for (const f of FIELDS) {
                const n = Number(values[f.key])
                payload[f.key] = f.money ? Math.round(n * 100) : Math.round(n)
              }
              const r = await adminSaveGymSettings(payload)
              if (!r.ok) { setError(r.error); return }
              setSaved(true)
              router.refresh()
            })
          }}
        >
          {isPending ? 'Saving…' : 'Save settings'}
        </Button>
        {saved && <span className="text-sm text-turquoise-700">Saved — live immediately</span>}
      </div>
    </div>
  )
}
