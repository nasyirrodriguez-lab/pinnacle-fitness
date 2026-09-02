import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export interface CurrentUserProfile {
  id: string
  email: string
  fullName: string | null
  phone: string | null
  company: string | null
  role: 'member' | 'admin'
  termsVersion: string | null
  termsAcceptedAt: string | null
}

// Per-request memoized: layout + page can both call without double-fetching.
export const getCurrentUser = cache(
  async (): Promise<CurrentUserProfile | null> => {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'id, email, full_name, phone, company, role, terms_version, terms_accepted_at'
      )
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      // First sign-in: trigger should have created the row, but fall back.
      return {
        id: user.id,
        email: user.email ?? '',
        fullName: null,
        phone: null,
        company: null,
        role: 'member',
        termsVersion: null,
        termsAcceptedAt: null,
      }
    }

    const row = profile as Record<string, unknown>
    return {
      id: row.id as string,
      email: row.email as string,
      fullName: (row.full_name as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      company: (row.company as string | null) ?? null,
      role: (row.role as 'member' | 'admin') ?? 'member',
      termsVersion: (row.terms_version as string | null) ?? null,
      termsAcceptedAt: (row.terms_accepted_at as string | null) ?? null,
    }
  }
)

export async function requireUser(): Promise<CurrentUserProfile> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}
