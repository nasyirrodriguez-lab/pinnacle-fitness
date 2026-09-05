import Link from 'next/link'
import { AiFillInstagram } from 'react-icons/ai'
import Wordmark from '@/components/logo/wordmark'
import DirectionsButton from '@/components/directions-button/directions-button'
import { LOCATION, CONTACT, HOURS } from '@/config/location'

export default function Footer() {
  return (
    <footer className="px-6 lg:px-12 py-16 bg-ground border-t border-bronze-line text-ice">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="md:col-span-1">
          <Wordmark width={170} dark />
          <p className="mt-4 text-sm text-ice-dim max-w-xs">
            A members-only coached gym. Small by design, so every coach knows
            every member by name.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-turf mb-3">
            Find us
          </p>
          <p className="text-sm font-semibold">{LOCATION.venue}</p>
          <p className="text-sm text-ice-dim">{LOCATION.streetLine1}</p>
          {LOCATION.streetLine2 && (
            <p className="text-sm text-ice-dim">{LOCATION.streetLine2}</p>
          )}
          <p className="text-sm text-ice-dim">
            {LOCATION.city}, {LOCATION.country}
          </p>
          <DirectionsButton variant="inline" className="mt-2" />
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-turf mb-3">
            Hours
          </p>
          <dl className="text-sm space-y-1">
            {HOURS.map((h) => (
              <div key={h.days} className="flex justify-between gap-4">
                <dt className="text-ice-dim">{h.days}</dt>
                <dd className="font-semibold tabular-nums">
                  {h.open ? `${h.open} – ${h.close}` : 'Closed'}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-turf mb-3">
            Talk to a coach
          </p>
          <ul className="text-sm space-y-1">
            {CONTACT.phones.map((p) => (
              <li key={p.name} className="flex justify-between gap-4">
                <span className="text-ice-dim">{p.name}</span>
                <a
                  href={`tel:${p.tel}`}
                  className="font-semibold tabular-nums hover:text-turf"
                >
                  {p.display}
                </a>
              </li>
            ))}
            <li className="pt-2">
              <a
                href={`mailto:${CONTACT.email}`}
                className="text-ice-dim hover:text-turf"
              >
                {CONTACT.email}
              </a>
            </li>
            <li>
              <a
                href={CONTACT.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pinnacle Fitness on Instagram"
                className="inline-flex items-center gap-2 text-ice-dim hover:text-turf"
              >
                <AiFillInstagram size={20} /> Instagram
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-12 pt-6 border-t border-bronze-line flex flex-wrap items-center justify-between gap-4 text-xs text-ice-mute">
        <p>
          &copy; {new Date().getFullYear()} {LOCATION.name}. Membership by
          application.
        </p>
        <div className="flex gap-5">
          <Link href="/apply" className="hover:text-turf">
            Apply
          </Link>
          <Link href="/terms" className="hover:text-turf">
            Member Code &amp; Terms
          </Link>
        </div>
      </div>
    </footer>
  )
}
