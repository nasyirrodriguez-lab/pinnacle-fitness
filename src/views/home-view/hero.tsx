'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  AiOutlineBuild,
  AiOutlineCalendar,
  AiOutlineDesktop,
  AiOutlinePhone,
} from 'react-icons/ai'

const TEXTS = ['entrepreneurs', 'innovators', 'creatives', 'collaborators']

const WORKSPACE_TYPES = [
  {
    label: 'Coworking',
    href: '/pricing',
    icon: AiOutlineDesktop,
  },
  {
    label: 'Private Offices',
    href: '/pricing',
    icon: AiOutlineBuild,
  },
  {
    label: 'Meeting Spaces',
    href: '/pricing',
    icon: AiOutlinePhone,
  },
  {
    label: 'Events',
    href: '/pricing',
    icon: AiOutlineCalendar,
  },
]

export default function Hero() {
  const [index, setIndex] = useState<number>(0)

  useEffect(() => {
    const intervalId = setInterval(() => setIndex((index) => index + 1), 3000)
    return () => clearTimeout(intervalId)
  }, [])

  return (
    <div className="relative flex items-center justify-center px-8 py-12 md:py-32">
      <Image
        src="/images/main-floor-2.jpg"
        alt="Coworking space at The Worx in Port of Spain, Trinidad"
        fill
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-10">
        <div className="bg-white p-8 md:p-12 lg:p-16 max-w-2xl w-full rounded-md">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-4xl leading-tight mb-6">
            A coworking space in Trinidad for{' '}
            <span className="inline-block leading-12 relative before:invisible before:pointer-events-none before:content-['entrepreneurs']">
              {TEXTS.map((t, i) => {
                const isActive = i === index % TEXTS.length
                return (
                  <span
                    key={t}
                    className="absolute top-0 left-0 px-2 bg-neutral-900 text-lime-500 transition-all duration-300 ease-in-out"
                    style={{
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? 'scale(1)' : 'scale(0.7)',
                      pointerEvents: isActive ? 'auto' : 'none',
                    }}
                  >
                    {t}
                  </span>
                )
              })}
            </span>
          </h1>

          <p className="text-neutral-600 text-md sm:text-lg md:text-xl mb-8">
            Welcome to The Worx &mdash; Trinidad &amp; Tobago&apos;s hub for
            innovation and collaboration, where professionals come together to
            share ideas and grow.
          </p>

          <div className="grid grid-cols-2 justify-center gap-2">
            {WORKSPACE_TYPES.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center gap-2 py-4 border border-neutral-100 rounded-md text-sm"
              >
                <Icon size={16} className="text-neutral-500" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
