import type { Metadata } from 'next'
import {
  Section,
  Eyebrow,
  Display,
  Pill,
  GYM,
} from '@/components/marketing/primitives'
import InquiryForm from '@/components/inquiry-form/inquiry-form'

export const metadata: Metadata = {
  title: 'Contact — Pinnacle Fitness',
  description:
    'Pinnacle Fitness at The Playground, 227 Western Main Rd, Port of Spain. Open Mon–Fri 5:30 AM–7 PM, Sat 7 AM–1 PM. WhatsApp Nasyir or Matthew.',
}

export default function ContactPage() {
  return (
    <Section>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 items-start">
        <div>
          <Eyebrow>Contact</Eyebrow>
          <Display as="h1">Talk to a coach.</Display>
          <p className="mt-6 max-w-md text-lg text-muted-foreground leading-relaxed">
            Questions about membership, training, or the space? WhatsApp is
            the fastest way to reach us.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {GYM.coaches.map((c) => (
              <div
                key={c.name}
                className="bg-card border border-border rounded-[22px] px-6 py-5 flex items-center justify-between gap-4 flex-wrap"
              >
                <div>
                  <p className="font-heading font-bold uppercase">{c.name}</p>
                  <a
                    href={`tel:+${c.wa}`}
                    className="font-stat text-2xl text-primary"
                  >
                    {c.phone}
                  </a>
                </div>
                <Pill href={`https://wa.me/${c.wa}`} external>
                  WhatsApp
                </Pill>
              </div>
            ))}
          </div>

          <dl className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.16em] uppercase text-muted-foreground mb-2">
                Where
              </dt>
              <dd>
                <p className="font-semibold">{GYM.venue}</p>
                <p className="text-muted-foreground">{GYM.address}</p>
                <a
                  href="https://maps.google.com/?q=227+Western+Main+Rd+Port+of+Spain"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-primary underline underline-offset-4 text-sm"
                >
                  Directions
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.16em] uppercase text-muted-foreground mb-2">
                Hours
              </dt>
              <dd className="space-y-1">
                {GYM.hours.map((h) => (
                  <div key={h.days} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{h.days}</span>
                    <span className="font-semibold whitespace-nowrap">
                      {h.time}
                    </span>
                  </div>
                ))}
              </dd>
            </div>
          </dl>
          <p className="mt-8 text-sm text-muted-foreground">
            Email:{' '}
            <a href={`mailto:${GYM.email}`} className="text-primary underline underline-offset-4">
              {GYM.email}
            </a>
          </p>
        </div>

        <div className="bg-card border border-border rounded-[22px] p-6 md:p-10">
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-primary mb-2">
            Or write to us
          </p>
          <p className="text-muted-foreground mb-6">
            Want to join? Use the{' '}
            <a href="/apply" className="text-primary underline underline-offset-4">
              application
            </a>{' '}
            instead — it goes straight to the coaches.
          </p>
          <InquiryForm />
        </div>
      </div>
    </Section>
  )
}
