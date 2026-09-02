'use client'

import { Fragment } from 'react'
import { AiOutlineNumber } from 'react-icons/ai'
import { Inquire } from '@/components/ctas/ctas'
import Inclusions from '@/components/inclusions/inclusions'
import Faqs from '@/components/faqs/faqs'
import { SERVICES } from '@/constants/constants'
import PageHeader from '@/components/page-header/page-header'

const THEME_COLORS: Record<string, string> = {
  turquoise: 'var(--color-turquoise-500)',
  lime: 'var(--color-lime-500)',
  darkOrange: 'var(--color-darkOrange-500)',
  orange: 'var(--color-orange-500)',
  slate: 'var(--color-slate-500)',
}

function ServicesView() {
  return (
    <Fragment>
      <PageHeader
        title="Workspace Solutions"
        description="Whether you need casual seating, your own desk space, a small office for your team, quiet meeting spaces, or a conference room, we've got you covered at The Worx."
        image={{
          src: '/images/desks.jpg',
          alt: 'Modern workspace solutions at The Worx coworking space',
        }}
      />
      <div className="py-16 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-12">
          <div className="flex flex-col gap-12">
            {SERVICES.map((service) => {
              const color =
                THEME_COLORS[service.theme] || THEME_COLORS.turquoise
              return (
                <div
                  key={service.id}
                  id={service.id}
                  className="grid grid-cols-1 xl:grid-cols-4 items-start gap-6 scroll-mt-24"
                >
                  <div>
                    <h2
                      className="mb-2 text-2xl font-medium underline underline-offset-4 decoration-4"
                      style={{ textDecorationColor: color }}
                    >
                      {service.name}
                    </h2>
                    <p>{service.description}</p>
                  </div>
                  <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {service.items.map((item) => {
                      const IconComponent = item.icon as React.ComponentType<{
                        size?: number
                        color?: string
                      }>
                      return (
                        <div
                          key={item.id}
                          className="bg-white border border-neutral-200 shadow-sm"
                        >
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <IconComponent size={20} color={color} />
                              {item.qty !== undefined && (
                                <div className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 text-sm">
                                  <AiOutlineNumber />
                                  <span>{item.qty}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="px-4 pb-4">
                            <h3 className="text-sm mb-2">{item.name}</h3>
                            <p className="text-sm">{item.description}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-12 text-center">
          <h2 className="text-2xl mb-4">Ready to find your workspace?</h2>
          <p className="mb-6 text-neutral-600">
            Let us know what you need and we&apos;ll help you get set up.
          </p>
          <Inquire />
        </div>
      </div>
      <Inclusions />
      <div className="py-24 px-12">
        <div className="max-w-4xl mx-auto">
          <Faqs />
        </div>
      </div>
    </Fragment>
  )
}

export default ServicesView
