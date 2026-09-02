import type { Viewport } from 'next'
import '@/theme/globals.css'
import { archivo } from '@/lib/fonts'
import { metadata as seoMetadata } from '@/seo'
import Header from '@/components/header/header'
import Footer from '@/components/footer/footer'
import SiteChrome from '@/components/site-chrome/site-chrome'
import { Providers } from '@/providers'
import { Analytics } from '@vercel/analytics/next'

export const metadata = {
  ...seoMetadata,
  appleWebApp: {
    capable: true,
    title: 'Pinnacle',
    statusBarStyle: 'black-translucent' as const,
  },
}

export const viewport: Viewport = {
  themeColor: '#0B0E0C',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${archivo.variable} dark`}>
      <head>
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
      </head>
      <body>
        <Providers>
          <SiteChrome header={<Header />} footer={<Footer />}>
            {children}
          </SiteChrome>
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
