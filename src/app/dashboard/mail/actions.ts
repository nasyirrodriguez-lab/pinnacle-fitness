'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

const ALLOWED_STATUSES = new Set(['received', 'collected', 'forwarded'])

export async function setMailStatus(
  mailId: string,
  status: string
): Promise<{ ok: boolean; error?: string }> {
  if (!ALLOWED_STATUSES.has(status)) {
    return { ok: false, error: 'Invalid status' }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const admin = createAdminClient()

  // Confirm the mail item belongs to this user before updating. Admins use
  // a separate admin endpoint.
  const { data: mail } = await admin
    .from('virtual_office_mail')
    .select('id, user_id')
    .eq('id', mailId)
    .maybeSingle()
  if (!mail || (mail as { user_id: string }).user_id !== user.id) {
    return { ok: false, error: 'Not found' }
  }

  const { error } = await admin
    .from('virtual_office_mail')
    .update({
      status,
      status_changed_at: new Date().toISOString(),
    })
    .eq('id', mailId)

  if (error) {
    return { ok: false, error: 'Update failed' }
  }
  revalidatePath('/dashboard/mail')
  return { ok: true }
}
