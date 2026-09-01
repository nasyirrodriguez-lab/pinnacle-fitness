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
  title: 'Pinnacle Fitness',
  description: 'Train hard. Find your rhythm. Build something together.',
  icons: {
    icon: '/PHOTO-2026-08-25-06-14-47.jpg',
    apple: '/PHOTO-2026-08-25-06-14-47.jpg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${playfair.variable}`}>
      <body className="min-h-full bg-[#F5F0E8] text-[#1C1A17] antialiased">
        {children}
        <ToastProvider />
      </body>
    </html>
  )
}
