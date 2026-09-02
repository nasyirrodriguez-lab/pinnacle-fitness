'use client'

import { Fragment } from 'react'
import Image from 'next/image'
import { BookNow } from '@/components/ctas/ctas'
import { SERVICES } from '@/constants/constants'

const THEME_COLORS: Record<string, string> = {
  turquoise: 'var(--color-turquoise-500)',
  lime: 'var(--color-lime-500)',
  darkOrange: 'var(--color-darkOrange-500)',
  orange: 'var(--color-orange-500)',
  slate: 'var(--color-slate-500)',
}

const OFFERINGS = SERVICES.flatMap((service) =>
  service.items.map((item) => ({
    id: item.id,
    count: item.qty !== undefined ? item.qty.toString() : '',
    desc: item.name,
    icon: item.icon,
    theme: service.theme,
    color: THEME_COLORS[service.theme] || THEME_COLORS.turquoise,
  }))
)

export default function Offerings() {
  return (
    <Fragment>
      <div className="px-6 md:px-12 py-12 lg:py-16 space-y-12 lg:space-y-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-12">
          <div>
            <h2 className="mb-4 text-3xl lg:text-4xl">What&apos;s On Site</h2>
            <p className="text-lg text-neutral-600">
              You&apos;ve worked from home, a coffee shop, a hotel lobby and
              even your car… now you can work from a thoughtfully designed space
              where you&apos;re surrounded by other progressive thinkers and
              innovative doers. Just choose your ideal spot!
            </p>
          </div>

          <div className="relative h-64 lg:h-auto lg:min-h-[480px] lg:order-first">
            <Image
              src="/images/meeting-space.jpg"
              alt="Hot desks and dedicated workspaces at The Worx"
              fill
              className="rounded-md object-cover"
            />
          </div>
        </div>

        <div className="max-w-6xl mx-auto space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {OFFERINGS.map((o) => {
              const IconComponent = o.icon as React.ComponentType<{
                size?: number
                color?: string
              }>
              return (
                <div
                  key={o.id}
                  className="p-4 border-2 rounded-md"
                  style={{
                    borderColor: o.color,
                  }}
                >
                  <div className="flex items-center gap-4 md:gap-6">
                    <IconComponent size={24} color={o.color} />
                    <p className="flex-1 text-md lg:text-lg uppercase">
                      {o.count && <span className="font-bold">{o.count} </span>}
                      <span className="text-neutral-700">{o.desc}</span>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="lg:col-span-2 lg:order-4">
            <div className="flex gap-2 justify-center">
              <BookNow label="Book a Seat" />
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  )
}
