import React from 'react'
import Image from 'next/image'

interface PageHeaderProps {
  title: React.ReactNode
  description: React.ReactNode
  image: {
    src: string
    alt: string
  }
}

export default function PageHeader({
  title,
  description,
  image,
}: PageHeaderProps) {
  return (
    <div className="bg-white">
      <div className="px-6 lg:px-12 py-12 lg:py-16">
        <div
          className={`grid grid-cols-1 ${image ? 'lg:grid-cols-2' : ''} items-center gap-12`}
        >
          <div>
            <h1 className="inline-block mb-6 py-2 px-4 text-white bg-neutral-900 text-2xl md:text-3xl">
              {title}
            </h1>
            <p className="text-neutral-900 text-lg md:text-xl max-w-xl">
              {description}
            </p>
          </div>

          <div className="relative h-72 lg:h-auto lg:min-h-[400px] lg:order-first">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              className="object-cover rounded-md"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
