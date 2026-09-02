// Single source of truth for The Worx's physical address.
// Update here, every page that displays the address updates.

export const LOCATION = {
  streetLine1: '1 Luis Street',
  streetLine2: null as string | null,
  city: 'Port of Spain',
  country: 'Trinidad & Tobago',
  countryCode: 'TT',
} as const

// Single-line address string suitable for maps app deep links.
export const fullAddressString = (): string => {
  const parts = [
    LOCATION.streetLine1,
    LOCATION.streetLine2,
    LOCATION.city,
    LOCATION.country,
  ].filter(Boolean) as string[]
  return parts.join(', ')
}

// Maps deep link that opens in the user's default maps app
// (Google Maps on Android/web, Apple Maps on iOS via universal links).
export const directionsUrl = (): string => {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    fullAddressString()
  )}`
}
