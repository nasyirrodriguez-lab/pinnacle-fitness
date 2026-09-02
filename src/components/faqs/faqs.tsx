'use client'

import { useState } from 'react'
import { AiOutlineMinusCircle, AiOutlinePlusCircle } from 'react-icons/ai'
import FAQS from '@/content/faqs'
import { BookNow } from '@/components/ctas/ctas'

function Faq({ title, description }: { title: string; description: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="mb-8 pb-8 border-b-2 border-neutral-100 cursor-pointer last:mb-0 last:pb-0 last:border-none"
      onClick={() => {
        setOpen(!open)
      }}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm md:text-xl text-neutral-900">{title}</h4>
        {open ? (
          <AiOutlineMinusCircle className="block m-0 text-neutral-300 w-5 h-5 md:w-6 md:h-6" />
        ) : (
          <AiOutlinePlusCircle className="block m-0 text-neutral-300 w-5 h-5 md:w-6 md:h-6" />
        )}
      </div>
      {open && (
        <div className="mt-8">
          <p className="text-neutral-900 text-base md:text-lg">{description}</p>
        </div>
      )}
    </div>
  )
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.title,
    acceptedAnswer: {
      '@type': 'Answer',
      text: f.description,
    },
  })),
}

function Faqs() {
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <h2 className="mb-12 text-neutral-900 text-4xl">FAQs</h2>
      {FAQS.map((f) => (
        <Faq key={f.id} title={f.title} description={f.description} />
      ))}
      <div className="mt-8 lg:mt-12">
        <div className="flex gap-2 justify-center">
          <BookNow />
        </div>
      </div>
    </div>
  )
}

export default Faqs
