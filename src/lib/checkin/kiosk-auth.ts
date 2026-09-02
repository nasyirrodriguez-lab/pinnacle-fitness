import { cookies } from 'next/headers'
import { signToken, verifyToken } from '@/lib/jwt'
import { createAdminClient } from '@/utils/supabase/admin'

const COOKIE_NAME = 'worx_kiosk'
// 1 year. The cookie is only useful if the device row is also unrevoked.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export interface KioskDevice {
  id: string
  label: string
  revoked_at: string | null
}

export async function setKioskCookie(deviceId: string): Promise<void> {
  const token = signToken({ v: 1, did: deviceId })
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}

export async function clearKioskCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

interface KioskTokenPayload {
  v: 1
  did: string
}

// Server-side guard for pages that should only render on a paired kiosk.
// Returns the device on success, or null when callers should render the
// "not paired" notice.
export async function requirePairedDevice(): Promise<KioskDevice | null> {
  return getPairedDevice()
}

export async function getPairedDevice(): Promise<KioskDevice | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null

  const payload = verifyToken<KioskTokenPayload>(token)
  if (!payload || payload.v !== 1 || typeof payload.did !== 'string') {
    return null
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('checkin_devices')
    .select('id, label, revoked_at')
    .eq('id', payload.did)
    .maybeSingle()
  if (!data) return null
  const device = data as unknown as KioskDevice
  if (device.revoked_at) return null

  // Best-effort heartbeat — don't await failures, but it's nice for the admin
  // UI to show last_seen.
  void admin
    .from('checkin_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', device.id)

  return device
}
