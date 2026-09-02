import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import ToastProvider from '@/components/ToastProvider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
})

export const metadata: Metadata = {
  title: 'Pinnacle Fitness — Train with us',
  description: "Trinidad's premier boutique gym. Book your first class free.",
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'Pinnacle Fitness — Train with us',
    description: "Trinidad's premier boutique gym. Book your first class free.",
    url: 'https://pinnaclefitnesstt.vercel.app',
    siteName: 'Pinnacle Fitness',
    images: [
      {
        url: 'https://pinnaclefitnesstt.vercel.app/PHOTO-2026-08-25-06-14-47.jpg',
        width: 1200,
        height: 630,
        alt: 'Pinnacle Fitness',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pinnacle Fitness — Train with us',
    description: "Trinidad's premier boutique gym. Book your first class free.",
    images: ['https://pinnaclefitnesstt.vercel.app/PHOTO-2026-08-25-06-14-47.jpg'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${playfair.variable}`}>
      <body className="min-h-full bg-[#E8E4DC] text-[#3A3733] antialiased">
        {children}
        <ToastProvider />
      </body>
    </html>
  )
}
