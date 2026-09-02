'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, QrCode } from 'lucide-react'
import Wordmark from '@/components/logo/wordmark'
import { AiFillInstagram, AiFillLinkedin } from 'react-icons/ai'
import { BookNow } from '@/components/ctas/ctas'
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
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/programs', label: 'Programs' },
  { href: '/coaches', label: 'Coaches' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
]

function Header() {
  const pathname = usePathname()
  const signedIn = useSignedInHint()

  return (
    <header
      className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-neutral-100"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="px-6 py-6 lg:px-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/">
              <Wordmark width={140} />
            </Link>
            <nav className="hidden lg:flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'text-sm font-medium hover:text-neutral-600 transition-colors',
                    {
                      'underline underline-offset-4 decoration-primary decoration-4':
                        pathname === link.href,
                    }
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-2">
              <a
                href="https://www.instagram.com/wearetheworx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <AiFillInstagram size={20} />
              </a>
              <a
                href="https://www.linkedin.com/company/wearetheworx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <AiFillLinkedin size={20} />
              </a>
            </div>
            {signedIn ? (
              <>
                <Link
                  href="/my-qr"
                  aria-label="Show my check-in QR code"
                  title="My check-in QR"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-md text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                >
                  <QrCode size={20} />
                </Link>
                <Link href="/dashboard">
                  <Button>Dashboard</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost">Sign in</Button>
                </Link>
                <BookNow variant="default" label="Book a Seat" />
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
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>
                  <Wordmark width={120} />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 px-4">
                {NAV_LINKS.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        'py-2 text-sm font-medium hover:text-neutral-600 transition-colors',
                        pathname === link.href && 'text-lime-500'
                      )}
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="flex items-center gap-4 px-4 pt-4 border-t border-neutral-100">
                <SheetClose asChild>
                  <a
                    href="https://www.instagram.com/wearetheworx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-600 hover:text-neutral-900 transition-colors"
                  >
                    <AiFillInstagram size={20} />
                  </a>
                </SheetClose>
                <SheetClose asChild>
                  <a
                    href="https://www.linkedin.com/company/wearetheworx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-600 hover:text-neutral-900 transition-colors"
                  >
                    <AiFillLinkedin size={20} />
                  </a>
                </SheetClose>
              </div>
              <div className="flex flex-col gap-2 px-4 pt-4">
                {signedIn ? (
                  <>
                    <SheetClose asChild>
                      <Link href="/dashboard">
                        <Button className="w-full">Dashboard</Button>
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
                      <span>
                        <BookNow label="Book a Seat" />
                      </span>
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
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

export default Header
