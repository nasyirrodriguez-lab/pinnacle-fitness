import type { SupabaseClient } from '@supabase/supabase-js'

// Designations are data-driven: roles live in the designation_roles
// table so management can add or rename tiers from the admin UI without
// a deploy. Anyone holding one checks in free — no subscription or pass
// required. profiles.designation is a FK to designation_roles.id.

export type Designation = string

export interface DesignationRole {
  id: string
  label: string
}

export async function loadDesignationRoles(
  client: SupabaseClient
): Promise<DesignationRole[]> {
  const { data } = await client
    .from('designation_roles')
    .select('id, label')
    .order('label', { ascending: true })
  return ((data as { id: string; label: string }[] | null) ?? []).map((r) => ({
    id: r.id,
    label: r.label,
  }))
}

export function roleLabel(
  roles: DesignationRole[],
  id: string | null
): string | null {
  if (!id) return null
  return roles.find((r) => r.id === id)?.label ?? id.replace(/_/g, ' ')
}
