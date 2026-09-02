'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

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
  if (!profile || (profile as { role?: string }).role !== 'admin') {
    return { error: 'Admin only' }
  }
  return { adminId: user.id }
}

const resolveSchema = z.object({
  requestId: z.string().uuid(),
  outcome: z.enum(['actioned', 'dismissed']),
})

export async function resolveMemberRequest(
  input: z.infer<typeof resolveSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = resolveSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid request' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('member_requests')
    .update({
      status: data.outcome,
      actioned_by: auth.adminId,
      actioned_at: new Date().toISOString(),
    })
    .eq('id', data.requestId)
    .eq('status', 'open')
  if (error) {
    console.error('[member-requests] resolve failed:', error)
    return { ok: false, error: 'Could not update the request' }
  }

  revalidatePath('/admin/notifications')
  return { ok: true }
}
