import React from 'react'
import Image from 'next/image'

interface PageHeaderProps {
  title: React.ReactNode
  description: React.ReactNode
  eyebrow?: React.ReactNode
  image?: {
    src: string
    alt: string
  }
}

export default function PageHeader({
  title,
  description,
  eyebrow,
  image,
}: PageHeaderProps) {
  return (
    <div className="bg-ground border-b border-bronze-line">
      <div className="px-6 lg:px-12 py-14 lg:py-20">
        <div
          className={`grid grid-cols-1 ${image ? 'lg:grid-cols-2' : ''} items-center gap-12`}
        >
          <div>
            {eyebrow && (
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-turf">
                {eyebrow}
              </p>
            )}
            <h1 className="heading-display text-4xl md:text-6xl text-ice mb-6 text-balance">
              {title}
            </h1>
            <p className="text-ice-dim text-lg md:text-xl max-w-xl">
              {description}
            </p>
          </div>

          {image && (
            <div className="relative h-72 lg:h-auto lg:min-h-[400px] lg:order-first">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover rounded-card"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
