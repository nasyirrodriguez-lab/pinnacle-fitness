import { CURRENT_TERMS_VERSION } from '@/config/terms'
import type { CurrentUserProfile } from './current-user'

export function needsOnboarding(profile: CurrentUserProfile): boolean {
  if (!profile.fullName || profile.fullName.trim().length === 0) return true
  if (profile.termsVersion !== CURRENT_TERMS_VERSION) return true
  if (!profile.termsAcceptedAt) return true
  // The PIN is the name-search fallback at the iPad; no member is done
  // until they have one.
  if (!profile.pinCode) return true
  return false
}
