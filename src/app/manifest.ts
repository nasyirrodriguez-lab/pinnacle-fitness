import type { MetadataRoute } from 'next'

// Dynamic web app manifest — the home-screen app members pin. Keeps the
// install + standalone experience in sync with the brand colours.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pinnacle Fitness',
    short_name: 'Pinnacle',
    description:
      'Your Pinnacle membership: book sessions with your coach, see what you have left, and scan in at the door.',
    start_url: '/dashboard',
    scope: '/',
    id: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B0E0C',
    theme_color: '#0B0E0C',
    categories: ['health', 'fitness', 'lifestyle'],
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Show my check-in QR',
        short_name: 'My QR',
        url: '/my-qr',
        description: 'Pull up your QR code to scan in at the door.',
      },
      {
        name: 'Book a session',
        short_name: 'Book',
        url: '/book',
        description: 'Book PT with Nasyir or Matthew.',
      },
    ],
  }
}
