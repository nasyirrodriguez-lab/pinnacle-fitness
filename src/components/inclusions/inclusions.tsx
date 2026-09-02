import Image from 'next/image'
import { BookNow } from '@/components/ctas/ctas'

const INCLUSIONS = [
  {
    id: 'microwave',
    name: 'Microwave',
  },
  {
    id: 'refrigerator',
    name: 'Refrigerator',
  },
  {
    id: 'secure-parking',
    name: 'Secure Parking',
  },
  {
    id: 'high-speed-internet',
    name: 'High Speed Internet',
  },
  {
    id: 'printers-scanners',
    name: 'Printers + Scanners',
  },
  {
    id: 'early-late-opening-hours',
    name: 'Early & Late Opening Hours',
  },
  {
    id: 'close-to-public-transportation',
    name: 'Close To Public Transportation',
  },
]

function Inclusions() {
  return (
    <div className="bg-neutral-900">
      <div className="px-6 md:px-12 py-12 lg:py-16 space-y-12 lg:space-y-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-12">
          <div>
            <h2 className="mb-4 text-white text-3xl lg:text-4xl">
              What&apos;s Included
            </h2>
            <p className="mb-8 text-white text-lg">
              Alongside comfortable workspaces and amenities your membership
              grants you access to meetups, educational workshops, community
              events and other perks.
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              {INCLUSIONS.map((i) => (
                <span
                  key={i.id}
                  className="px-3 py-1 text-sm border border-primary text-primary rounded-full"
                >
                  {i.name}
                </span>
              ))}
            </div>
            <div>
              <div className="flex gap-2">
                <BookNow />
              </div>
            </div>
          </div>

          <div className="relative h-64 lg:h-auto lg:min-h-[480px]">
            <Image
              src="/images/nook-1.jpg"
              alt="Amenities and common areas at The Worx coworking space"
              fill
              className="rounded-md object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Inclusions
