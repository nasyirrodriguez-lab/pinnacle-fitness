'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

const profileSchema = z.object({
  fullName: z.string().min(1, 'Your name is required').max(120),
  phone: z.string().max(40).optional().nullable(),
  company: z.string().max(120).optional().nullable(),
})

export type UpdateProfileResult = { ok: true } | { ok: false; error: string }

export async function updateProfile(
  input: z.infer<typeof profileSchema>
): Promise<UpdateProfileResult> {
  let data
  try {
    data = profileSchema.parse(input)
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: message }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  // RLS policy profiles_self_update allows the user to update their own row.
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: data.fullName.trim(),
      phone: data.phone?.trim() || null,
      company: data.company?.trim() || null,
    })
    .eq('id', user.id)

  if (error) {
    console.error('[settings/updateProfile] failed:', error)
    return { ok: false, error: 'Could not save your changes. Try again.' }
  }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
  return { ok: true }
}
