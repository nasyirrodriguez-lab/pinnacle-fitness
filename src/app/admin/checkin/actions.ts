'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isOwner } from '@/lib/auth/roles'
import { setKioskCookie } from '@/lib/checkin/kiosk-auth'

async function assertAdmin(): Promise<{ adminId: string } | { error: string }> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || !isOwner((profile as { role?: string }).role)) {
    return { error: 'Owners only' }
  }
  return { adminId: user.id }
}

export async function pairKioskDevice(formData: FormData): Promise<void> {
  const auth = await assertAdmin()
  if ('error' in auth) throw new Error(auth.error)

  const label = (
    formData.get('label')?.toString().trim() || 'Front desk iPad'
  ).slice(0, 100)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('checkin_devices')
    .insert({ label, paired_by: auth.adminId })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error('Could not pair device')
  }
  await setKioskCookie((data as { id: string }).id)

  revalidatePath('/admin/checkin')
  redirect('/checkin')
}

export async function revokeKioskDevice(formData: FormData): Promise<void> {
  const auth = await assertAdmin()
  if ('error' in auth) throw new Error(auth.error)

  const deviceId = formData.get('deviceId')?.toString()
  if (!deviceId) throw new Error('Missing deviceId')

  const admin = createAdminClient()
  await admin
    .from('checkin_devices')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', deviceId)

  revalidatePath('/admin/checkin')
}

export type AdminCheckOutResult = { ok: true } | { ok: false; error: string }

// Check a visitor out from the admin side (mission control live feed or
// the visits page). Idempotent — a second click reports already-out.
export async function adminCheckOutVisit(
  visitId: string
): Promise<AdminCheckOutResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  if (!/^[0-9a-f-]{36}$/i.test(visitId)) {
    return { ok: false, error: 'Invalid visit' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('visits')
    .update({ checked_out_at: new Date().toISOString() })
    .eq('id', visitId)
    .is('checked_out_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[admin/checkOutVisit] update failed:', error)
    return { ok: false, error: 'Could not check out' }
  }
  if (!data) {
    return { ok: false, error: 'Already checked out' }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/checkin/visits')
  return { ok: true }
}
