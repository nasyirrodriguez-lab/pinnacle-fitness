import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-only Supabase client using the service-role key. Bypasses RLS.
// Use ONLY in:
//   - Webhook handlers (where there is no authenticated user)
//   - Admin-side server actions/routes that have already verified is_admin()
// Never import this from a Client Component or expose to the browser.
//
// Returns an untyped client (SupabaseClient) — we lose row-level type
// inference, but we don't have generated Database types yet. Worth the
// trade until we run `supabase gen types`.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let cached: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (cached) return cached
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
    )
  }
  cached = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}
