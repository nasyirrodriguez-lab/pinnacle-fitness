import { getBaseUrl } from '@/utils/getBaseUrl'
import type { Metadata } from 'next'

const baseUrl = getBaseUrl()

const seo = {
  title: 'The Worx',
  subtitle: 'A Coworking Space in Trinidad for Entrepreneurs & Creatives',
  description:
    'Work remotely from a creative coworking space in Port of Spain with high speed wifi, private meeting rooms and flexible workspaces. Meet, learn and grow at The Worx.',
  url: baseUrl,
  og: {
    img: `${baseUrl}/og.png`,
  },
}

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: seo.subtitle,
    template: `%s | ${seo.title}`,
  },
  description: seo.description,
  keywords: [
    'coworking space',
    'Trinidad',
    'Port of Spain',
    'remote work',
    'office space',
    'hot desk',
    'dedicated desk',
    'private office',
    'meeting room',
    'entrepreneurs',
    'creatives',
    'freelancers',
    'startups',
  ],
  authors: [{ name: 'The Worx' }],
  creator: 'The Worx',
  openGraph: {
    type: 'website',
    locale: 'en_TT',
    url: baseUrl,
    siteName: seo.title,
    title: seo.subtitle,
    description: seo.description,
    images: [
      {
        url: seo.og.img,
        width: 1200,
        height: 630,
        alt: seo.subtitle,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: seo.subtitle,
    description: seo.description,
    images: [seo.og.img],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: baseUrl,
  },
}

export const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CoworkingSpace',
  name: seo.title,
  description: seo.description,
  url: baseUrl,
  image: seo.og.img,
  telephone: '+1-868-281-0830',
  email: 'team@theworx.io',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '1 Luis Street',
    addressLocality: 'Port of Spain',
    addressCountry: 'TT',
  },
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '09:00',
    closes: '17:00',
  },
  priceRange: '$100 - $7,500 TTD',
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'High Speed WiFi' },
    { '@type': 'LocationFeatureSpecification', name: 'Meeting Rooms' },
    { '@type': 'LocationFeatureSpecification', name: 'Private Offices' },
    { '@type': 'LocationFeatureSpecification', name: 'Hot Desks' },
    { '@type': 'LocationFeatureSpecification', name: 'Parking' },
  ],
}

export default seo
