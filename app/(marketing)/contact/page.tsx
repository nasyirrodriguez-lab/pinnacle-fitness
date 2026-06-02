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
    value: '1200 Pinnacle Blvd, Suite 100\nAustin, TX 78701',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
    label: 'Phone',
    value: '(512) 555-0192',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    label: 'Email',
    value: 'hello@pinnaclefitness.com',
  },
]

const hours = [
  { day: 'Monday – Friday', time: '5:00 AM – 11:00 PM' },
  { day: 'Saturday', time: '6:00 AM – 10:00 PM' },
  { day: 'Sunday', time: '7:00 AM – 9:00 PM' },
]

export default function ContactPage() {
  return (
    <div className="bg-zinc-950">
      {/* Header */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-black text-white">Get in Touch</h1>
        <p className="mt-4 text-zinc-400 max-w-md mx-auto text-sm sm:text-base">
          Questions about membership, classes, or anything else? We're here for you.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left column — info + map */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact cards */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
              {contactInfo.map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
                    {icon}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-sm text-zinc-300 whitespace-pre-line">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Hours */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-sm font-bold text-white mb-4">Opening Hours</h3>
              <ul className="space-y-2">
                {hours.map(({ day, time }) => (
                  <li key={day} className="flex justify-between text-sm">
                    <span className="text-zinc-500">{day}</span>
                    <span className="text-zinc-300 font-medium">{time}</span>
                  </li>
                ))}
                <li className="pt-2 border-t border-zinc-800 flex justify-between text-sm">
                  <span className="text-orange-400 font-medium">Elite Members</span>
                  <span className="text-orange-400 font-medium">24/7</span>
                </li>
              </ul>
            </div>

            {/* Google Maps embed */}
            <div className="rounded-2xl border border-zinc-800 overflow-hidden">
              <iframe
                title="Pinnacle Fitness Location"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3445.8875!2d-97.7430!3d30.2672!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDE2JzAyLjAiTiA5N8KwNDQnMzQuOCJX!5e0!3m2!1sen!2sus!4v1700000000000"
                width="100%"
                height="220"
                style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg)' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>

          {/* Right column — form */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
              <h2 className="text-lg font-bold text-white mb-6">Send Us a Message</h2>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
