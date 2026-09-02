import { notFound, redirect } from 'next/navigation'
import { getCurrentUser, type CurrentUserProfile } from './current-user'
import { isOwner, isTeam } from './roles'

// Server-side gates. Not signed in → /sign-in. Signed in without the
// role → 404 (we don't leak the existence of staff areas to members).

// The business portal (/admin/*): owners.
export async function requireAdmin(): Promise<CurrentUserProfile> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in?next=/admin')
  if (!isOwner(user.role)) notFound()
  return user
}

export const requireOwner = requireAdmin

// Coach pages (/coach/*): coaches and owners with a coaches row.
export async function requireCoach(): Promise<
  CurrentUserProfile & { coachId: string }
> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in?next=/coach')
  if (!isTeam(user.role) || !user.coachId) notFound()
  return { ...user, coachId: user.coachId }
}
