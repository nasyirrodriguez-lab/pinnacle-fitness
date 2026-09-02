'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { inviteMember } from '@/lib/members/invite'

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

const createMemberSchema = z.object({
  email: z.string().email('A valid email is required').max(200),
  fullName: z.string().trim().min(1, 'Name is required').max(120),
  phone: z.string().trim().max(40).optional(),
  designation: z.string().min(1).max(60).nullable().optional(),
})

export type CreateMemberResult =
  | { ok: true; userId: string }
  | { ok: false; error: string }

export async function adminCreateMember(
  input: z.infer<typeof createMemberSchema>
): Promise<CreateMemberResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  let data
  try {
    data = createMemberSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const result = await inviteMember({
    email: data.email,
    fullName: data.fullName,
    phone: data.phone || null,
    designation: data.designation ?? null,
  })
  if (!result.ok) return result

  revalidatePath('/admin/members')
  revalidatePath(`/admin/members/${result.userId}`)
  return { ok: true, userId: result.userId }
}
