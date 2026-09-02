import Link from 'next/link'
import { Smartphone, Trash2 } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { fmtAstDateTime } from '@/lib/time/ast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { pairKioskDevice, revokeKioskDevice } from './actions'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Check-in devices — Admin',
}

interface DeviceRow {
  id: string
  label: string
  paired_at: string
  last_seen_at: string | null
  revoked_at: string | null
}

async function loadDevices(): Promise<DeviceRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('checkin_devices')
    .select('id, label, paired_at, last_seen_at, revoked_at')
    .order('paired_at', { ascending: false })
  return (data ?? []) as unknown as DeviceRow[]
}

const fmt = fmtAstDateTime

export default async function AdminCheckinPage() {
  const devices = await loadDevices()
  const active = devices.filter((d) => !d.revoked_at)
  const revoked = devices.filter((d) => d.revoked_at)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl mb-2">
            Check-in devices
          </h1>
          <p className="text-sm text-neutral-600">
            Pair this tablet to use it as a check-in kiosk. Only paired devices
            can record check-ins.
          </p>
        </div>
        <Link
          href="/admin/checkin/visits"
          className="text-sm text-turquoise-700 hover:text-turquoise-900 underline"
        >
          View visits →
        </Link>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <h2 className="font-heading text-lg mb-3">Pair this device</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Do this from the tablet you want to use at the front desk. After
          pairing you&apos;ll be sent to <code>/checkin</code>.
        </p>
        <form
          action={pairKioskDevice}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[220px]">
            <Label htmlFor="label">Device label</Label>
            <Input
              id="label"
              name="label"
              placeholder="Front desk iPad"
              defaultValue="Front desk iPad"
              required
              maxLength={100}
            />
          </div>
          <Button type="submit">
            <Smartphone size={16} className="mr-2" />
            Pair this device
          </Button>
        </form>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="font-heading text-lg">Paired devices</h2>
        </div>
        {active.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">No paired devices yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {active.map((d) => (
              <li
                key={d.id}
                className="px-6 py-4 flex flex-wrap items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{d.label}</p>
                  <p className="text-xs text-neutral-500">
                    Paired {fmt(d.paired_at)} · Last seen {fmt(d.last_seen_at)}
                  </p>
                </div>
                <form action={revokeKioskDevice}>
                  <input type="hidden" name="deviceId" value={d.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    <Trash2 size={14} className="mr-1" />
                    Revoke
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {revoked.length > 0 && (
        <details className="bg-white border border-neutral-200 rounded-lg p-4">
          <summary className="text-sm font-medium cursor-pointer">
            Revoked devices ({revoked.length})
          </summary>
          <ul className="mt-3 space-y-1 text-xs text-neutral-500">
            {revoked.map((d) => (
              <li key={d.id}>
                {d.label} — revoked {fmt(d.revoked_at)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
