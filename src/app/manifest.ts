import type { MetadataRoute } from 'next'

// Dynamic web app manifest. Keeps the install + standalone experience in
// sync with our brand colours and lets us evolve fields without editing a
// static JSON file. The previous public/site.webmanifest is superseded by
// this route — Next.js will serve /manifest.webmanifest from here.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Worx — Member',
    short_name: 'The Worx',
    description:
      'Your member dashboard for The Worx coworking in Port of Spain. Book a room, manage your plan, and check in at the door.',
    start_url: '/dashboard',
    scope: '/',
    id: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#D9E01F',
    theme_color: '#D9E01F',
    categories: ['business', 'productivity', 'lifestyle'],
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
        description: 'Quickly pull up your QR code for door check-in.',
      },
      {
        name: 'Book a room',
        short_name: 'Book',
        url: '/book',
        description: 'Reserve a meeting room or conference room.',
      },
      {
        name: 'My bookings',
        short_name: 'Bookings',
        url: '/dashboard/bookings',
        description: 'See and manage upcoming bookings.',
      },
    ],
  }
}
