import Link from 'next/link'
import { AiFillInstagram, AiFillLinkedin } from 'react-icons/ai'
import Icon from '@/components/logo/icon'
import DirectionsButton from '@/components/directions-button/directions-button'
import { LOCATION } from '@/config/location'

export default function Footer() {
  return (
    <footer className="px-8 py-16 bg-neutral-900">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <Icon color="white" size={96} />
        </div>
        <div>
          <div className="flex flex-col items-start gap-4">
            <h4 className="text-white text-xl">The Worx</h4>
            <div>
              <p className="text-white">{LOCATION.streetLine1}</p>
              {LOCATION.streetLine2 && (
                <p className="text-white">{LOCATION.streetLine2}</p>
              )}
              <p className="text-white">{LOCATION.city}</p>
              <p className="text-white">{LOCATION.country}</p>
              <DirectionsButton variant="inline" className="mt-2" />
            </div>
            <div>
              <div className="flex flex-col items-start gap-0">
                <a
                  href="mailto:team@theworx.io"
                  className="text-white hover:text-turquoise-500"
                >
                  team@theworx.io
                </a>
                <a
                  href="tel:+18682810830"
                  className="text-white hover:text-turquoise-500"
                >
                  +1 (868) 281-0830
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="justify-self-start md:justify-self-end">
          <div className="flex items-center gap-2">
            <a
              href="https://www.instagram.com/wearetheworx"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow The Worx on Instagram"
              className="text-white hover:text-turquoise-500"
            >
              <AiFillInstagram size={24} />
            </a>
            <a
              href="https://www.linkedin.com/company/wearetheworx"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow The Worx on LinkedIn"
              className="text-white hover:text-turquoise-500"
            >
              <AiFillLinkedin size={24} />
            </a>
          </div>
        </div>
      </div>
      <div className="mt-12 pt-6 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-400">
        <p>&copy; {new Date().getFullYear()} The Worx. All rights reserved.</p>
        <Link href="/terms" className="hover:text-turquoise-500">
          Terms and Conditions
        </Link>
      </div>
    </footer>
  )
}
