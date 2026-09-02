'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendMessageFromMember } from '@/lib/notifications/notify'
import { sendMemberMessageToTeam } from '@/lib/email/messages'

const sendSchema = z.object({
  body: z.string().trim().min(1, 'Write a message first').max(5000),
})

export type MemberSendResult = { ok: true } | { ok: false; error: string }

export async function sendMessageToTeam(
  input: z.infer<typeof sendSchema>
): Promise<MemberSendResult> {
  let data
  try {
    data = sendSchema.parse(input)
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof z.ZodError
          ? (err.issues[0]?.message ?? 'Invalid message')
          : 'Invalid message',
    }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to send a message' }

  const admin = createAdminClient()
  const result = await sendMessageFromMember(admin, {
    userId: user.id,
    body: data.body,
  })
  if (!result.ok) return result

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle()
  const p = profile as { full_name: string | null; email: string } | null
  await sendMemberMessageToTeam({
    admin,
    memberName: p?.full_name?.trim() || p?.email || 'A member',
    memberEmail: p?.email ?? '',
    body: data.body,
  })

  revalidatePath('/dashboard/messages')
  revalidatePath('/admin/notifications')
  return { ok: true }
}
