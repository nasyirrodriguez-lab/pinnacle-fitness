import { CURRENT_TERMS_VERSION } from '@/config/terms'
import type { CurrentUserProfile } from './current-user'

export function needsOnboarding(profile: CurrentUserProfile): boolean {
  if (!profile.fullName || profile.fullName.trim().length === 0) return true
  if (profile.termsVersion !== CURRENT_TERMS_VERSION) return true
  if (!profile.termsAcceptedAt) return true
  return false
}
