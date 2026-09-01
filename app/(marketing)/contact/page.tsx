import ContactForm from '@/components/marketing/ContactForm'

const contactInfo = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    label: 'Address',
    value: '227 Western Main Road\nCocorite, Trinidad',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
    label: 'Phone',
    value: 'Nasyir: 688-6887\nMatthew: 724-5734',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    label: 'Email',
    value: 'pinnaclefitness@gmail.com',
  },
]

const hours = [
  { day: 'Monday – Friday', time: '5:30 AM – 7:00 PM' },
  { day: 'Saturday', time: '7:00 AM – 1:00 PM' },
]

export default function ContactPage() {
  return (
    <div className="bg-[#D6D3CC] min-h-screen pt-20">
      {/* Header */}
      <div className="py-20 px-6 sm:px-12 max-w-6xl mx-auto">
        <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">Contact</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-[#1C1A17] mb-4">Get in touch.</h1>
        <p className="text-[#6B6560] text-lg max-w-md">
          Questions about membership, classes, or anything else? We&apos;re here for you.
        </p>
      </div>

      <div className="px-6 sm:px-12 pb-24 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact info */}
            <div className="bg-white rounded-2xl border border-[#C4C1BA] p-6 space-y-5">
              {contactInfo.map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#D6D3CC] text-[#54504A]">
                    {icon}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#6B6560] uppercase tracking-[0.15em] mb-0.5">{label}</p>
                    <p className="text-sm text-[#1C1A17] whitespace-pre-line">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Hours */}
            <div className="bg-white rounded-2xl border border-[#C4C1BA] p-6">
              <h3 className="text-xs font-medium text-[#6B6560] uppercase tracking-[0.15em] mb-4">Opening Hours</h3>
              <ul className="space-y-2">
                {hours.map(({ day, time }) => (
                  <li key={day} className="flex justify-between text-sm">
                    <span className="text-[#6B6560]">{day}</span>
                    <span className="text-[#1C1A17] font-medium">{time}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right column — form */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-[#C4C1BA] p-8">
              <h2 className="font-serif text-2xl text-[#1C1A17] mb-6">Send Us a Message</h2>
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
