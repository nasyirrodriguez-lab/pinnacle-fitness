'use client'

import { usePathname } from 'next/navigation'

// Routes that should render fullscreen without the marketing header/footer.
// Kiosk + standalone screens that run on dedicated devices live here.
const CHROMELESS_PREFIXES = ['/checkin']

interface Props {
  header: React.ReactNode
  footer: React.ReactNode
  children: React.ReactNode
}

export default function SiteChrome({ header, footer, children }: Props) {
  const pathname = usePathname() ?? '/'
  const chromeless = CHROMELESS_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )

  if (chromeless) return <>{children}</>

  return (
    <>
      {header}
      <main>{children}</main>
      {footer}
    </>
  )
}
