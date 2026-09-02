// Single source of truth for Pinnacle's physical location, hours and
// contact details. Update here; every page that shows them updates.

export const LOCATION = {
  name: 'Pinnacle Fitness',
  venue: 'The Playground — Sport & Social',
  streetLine1: '227 Western Main Road',
  streetLine2: 'Cocorite' as string | null,
  city: 'Port of Spain',
  country: 'Trinidad & Tobago',
  countryCode: 'TT',
  timeZone: 'America/Port_of_Spain',
} as const

export const CONTACT = {
  email: 'hello@pinnaclefitness.app',
  domain: 'pinnaclefitness.app',
  siteUrl: 'https://pinnaclefitness.app',
  instagram: 'https://www.instagram.com/pinnaclefitnesstt',
  phones: [
    { name: 'Nasyir', display: '688-6887', tel: '+18686886887' },
    { name: 'Matthew', display: '724-5734', tel: '+18687245734' },
  ],
} as const

export const HOURS = [
  { days: 'Mon – Fri', open: '5:30 AM', close: '7:00 PM' },
  { days: 'Saturday', open: '7:00 AM', close: '1:00 PM' },
  { days: 'Sunday', open: null, close: null },
] as const

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
