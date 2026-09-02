'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isOwner } from '@/lib/auth/roles'

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

export type DesignationActionResult =
  | { ok: true }
  | { ok: false; error: string }

function revalidate() {
  revalidatePath('/admin/members/designations')
  revalidatePath('/admin/members')
}

const labelField = z.string().trim().min(2, 'Give the role a name').max(60)

export async function adminCreateDesignationRole(input: {
  label: string
}): Promise<DesignationActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let label
  try {
    label = labelField.parse(input.label)
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof z.ZodError
          ? (err.issues[0]?.message ?? 'Invalid name')
          : 'Invalid name',
    }
  }

  const id = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  if (!id) return { ok: false, error: 'Give the role a usable name' }

  const admin = createAdminClient()
  const { error } = await admin.from('designation_roles').insert({ id, label })
  if (error) {
    const isDupe = (error as { code?: string }).code === '23505'
    return {
      ok: false,
      error: isDupe
        ? 'A role with that name already exists.'
        : 'Could not create role',
    }
  }
  revalidate()
  return { ok: true }
}

export async function adminRenameDesignationRole(input: {
  id: string
  label: string
}): Promise<DesignationActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let label
  try {
    label = labelField.parse(input.label)
  } catch {
    return { ok: false, error: 'Give the role a name' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('designation_roles')
    .update({ label })
    .eq('id', input.id)
  if (error) return { ok: false, error: 'Could not rename role' }
  revalidate()
  return { ok: true }
}

export async function adminDeleteDesignationRole(input: {
  id: string
}): Promise<DesignationActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('designation_roles')
    .delete()
    .eq('id', input.id)
  if (error) {
    const inUse = (error as { code?: string }).code === '23503'
    return {
      ok: false,
      error: inUse
        ? 'People still hold this role — remove them from it first.'
        : 'Could not delete role',
    }
  }
  revalidate()
  return { ok: true }
}

const assignSchema = z.object({
  email: z.string().email('Enter a valid email'),
  roleId: z.string().min(1).max(60),
})

export async function adminAssignDesignation(
  input: z.infer<typeof assignSchema>
): Promise<DesignationActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = assignSchema.parse(input)
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof z.ZodError
          ? (err.issues[0]?.message ?? 'Invalid input')
          : 'Invalid input',
    }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', data.email.toLowerCase().trim())
    .maybeSingle()
  if (!profile) {
    return {
      ok: false,
      error:
        'No account with that email. Create one first via Members → Add member (you can pick the role there).',
    }
  }

  const { error } = await admin
    .from('profiles')
    .update({ designation: data.roleId })
    .eq('id', (profile as { id: string }).id)
  if (error) return { ok: false, error: 'Could not assign role' }
  revalidate()
  return { ok: true }
}

export async function adminClearDesignation(input: {
  userId: string
}): Promise<DesignationActionResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!z.string().uuid().safeParse(input.userId).success) {
    return { ok: false, error: 'Invalid member' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ designation: null })
    .eq('id', input.userId)
  if (error) return { ok: false, error: 'Could not remove role' }
  revalidate()
  return { ok: true }
}
