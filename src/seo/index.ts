import { getBaseUrl } from '@/utils/getBaseUrl'
import type { Metadata } from 'next'

const baseUrl = getBaseUrl()

const seo = {
  title: 'Pinnacle Fitness',
  subtitle: 'A members-only coached gym in Port of Spain',
  description:
    'A members-only coached gym at The Playground, Port of Spain. Apply to train with Nasyir and Matthew — small-group personal training, open gym, and a community that shows up.',
  url: baseUrl,
  og: {
    img: `${baseUrl}/og.png`,
  },
}

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: `${seo.title} — ${seo.subtitle}`,
    template: `%s | ${seo.title}`,
  },
  description: seo.description,
  keywords: [
    'gym',
    'personal training',
    'Port of Spain',
    'Trinidad',
    'Cocorite',
    'small group training',
    'strength training',
    'open gym',
    'coached sessions',
  ],
  authors: [{ name: 'Pinnacle Fitness' }],
  creator: 'Pinnacle Fitness',
  openGraph: {
    type: 'website',
    locale: 'en_TT',
    url: baseUrl,
    siteName: seo.title,
    title: `${seo.title} — ${seo.subtitle}`,
    description: seo.description,
    images: [
      {
        url: seo.og.img,
        width: 1200,
        height: 630,
        alt: seo.title,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${seo.title} — ${seo.subtitle}`,
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

export default seo
