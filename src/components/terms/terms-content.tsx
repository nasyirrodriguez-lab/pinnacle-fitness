import {
  TERMS_INTRO,
  TERMS_SECTIONS,
  TERMS_ACKNOWLEDGEMENT,
} from '@/config/terms'

interface Props {
  // When true, wraps in a scroll container — useful in modals or alongside a form.
  scrollable?: boolean
  className?: string
}

export default function TermsContent({ scrollable = false, className }: Props) {
  const base = 'text-sm text-neutral-700 leading-relaxed'
  const container = scrollable
    ? 'max-h-96 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-4'
    : ''

  return (
    <div className={`${container} ${className ?? ''}`}>
      <h2 className="font-heading text-2xl mb-1">
        The Worx — Terms and Conditions
      </h2>
      <p className="whitespace-pre-line text-xs text-neutral-500 mb-6">
        {TERMS_INTRO}
      </p>

      {TERMS_SECTIONS.map((section) => (
        <section key={section.number} className="mb-6 last:mb-0">
          <h3 className="font-heading text-base mb-2">
            {section.number}. {section.title}
          </h3>
          <div className="space-y-2">
            {section.body.map((para, i) => (
              <p key={i} className={base}>
                {para}
              </p>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-8 pt-6 border-t border-neutral-200">
        <h3 className="font-heading text-base mb-2">Member acknowledgement</h3>
        <p className={base}>{TERMS_ACKNOWLEDGEMENT}</p>
      </section>
    </div>
  )
}
