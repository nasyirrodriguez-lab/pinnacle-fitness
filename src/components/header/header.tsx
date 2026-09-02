'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, QrCode } from 'lucide-react'
import Wordmark from '@/components/logo/wordmark'
import { AiFillInstagram } from 'react-icons/ai'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useSignedInHint } from '@/lib/auth-hint'
import { CONTACT } from '@/config/location'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/programs', label: 'Programs' },
  { href: '/coaches', label: 'Coaches' },
  { href: '/pricing', label: 'Pricing' },
]

function Header() {
  const pathname = usePathname()
  const signedIn = useSignedInHint()

  return (
    <header
      className="sticky top-0 z-30 bg-ground/90 backdrop-blur border-b border-bronze-line"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="px-6 py-4 lg:px-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link href="/" className="text-ice">
              <Wordmark width={150} />
            </Link>
            <nav className="hidden lg:flex items-center gap-7">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'text-sm font-semibold tracking-wide uppercase transition-colors',
                    pathname === link.href
                      ? 'text-turf'
                      : 'text-ice-dim hover:text-ice'
                  )}
                  style={{ fontVariationSettings: "'wdth' 105" }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <a
              href={CONTACT.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Pinnacle Fitness on Instagram"
              className="text-ice-dim hover:text-ice transition-colors mr-1"
            >
              <AiFillInstagram size={20} />
            </a>
            {signedIn ? (
              <>
                <Link
                  href="/my-qr"
                  aria-label="Show my check-in QR code"
                  title="My check-in QR"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full text-ice-dim hover:bg-bronze hover:text-ice transition-colors"
                >
                  <QrCode size={20} />
                </Link>
                <Link href="/dashboard">
                  <Button>My Pinnacle</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost">Sign in</Button>
                </Link>
                <Link href="/apply">
                  <Button>Apply to join</Button>
                </Link>
              </>
            )}
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={24} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-ground border-bronze-line">
              <SheetHeader>
                <SheetTitle className="text-ice">
                  <Wordmark width={130} />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {NAV_LINKS.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        'py-3 text-lg font-bold uppercase tracking-wide transition-colors',
                        pathname === link.href
                          ? 'text-turf'
                          : 'text-ice hover:text-turf'
                      )}
                      style={{ fontVariationSettings: "'wdth' 110" }}
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="flex flex-col gap-2 px-4 pt-4 border-t border-bronze-line">
                {signedIn ? (
                  <>
                    <SheetClose asChild>
                      <Link href="/dashboard">
                        <Button className="w-full">My Pinnacle</Button>
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/my-qr">
                        <Button variant="outline" className="w-full">
                          <QrCode size={16} className="mr-2" />
                          My check-in QR
                        </Button>
                      </Link>
                    </SheetClose>
                  </>
                ) : (
                  <>
                    <SheetClose asChild>
                      <Link href="/apply">
                        <Button className="w-full">Apply to join</Button>
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/sign-in">
                        <Button variant="outline" className="w-full">
                          Sign in
                        </Button>
                      </Link>
                    </SheetClose>
                  </>
                )}
                <a
                  href={CONTACT.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 pt-3 text-sm text-ice-dim hover:text-ice"
                >
                  <AiFillInstagram size={18} /> Instagram
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

export default Header
