import { notFound, redirect } from 'next/navigation'
import { getCurrentUser, type CurrentUserProfile } from './current-user'

// Server-side gate for /admin/*. Non-signed-in → /sign-in. Signed-in non-admin
// → 404 (we don't leak the existence of /admin to regular members).
export async function requireAdmin(): Promise<CurrentUserProfile> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in?next=/admin')
  if (user.role !== 'admin') notFound()
  return user
}
