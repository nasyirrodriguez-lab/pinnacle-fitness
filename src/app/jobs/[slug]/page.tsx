import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ChevronLeft, MapPin, Clock, Briefcase, ArrowRight } from 'lucide-react'
import { JOBS, getJob } from '@/config/jobs'

interface PageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return JOBS.map((j) => ({ slug: j.slug }))
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const job = getJob(slug)
  if (!job) return { title: 'Job not found' }

  const description = `${job.contractType} · ${job.location}${job.salary ? ` · ${job.salary}` : ''}. ${job.roleSummary.slice(0, 120)}`

  return {
    title: `${job.title} | The Worx`,
    description,
    alternates: { canonical: `/jobs/${job.slug}` },
    openGraph: {
      title: `${job.title} at The Worx`,
      description,
      url: `/jobs/${job.slug}`,
      type: 'article',
    },
  }
}

function jobPostingJsonLd(job: ReturnType<typeof getJob>) {
  if (!job) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: `${job.roleSummary}\n\n${job.focusAreas
      .map((f) => `${f.title}:\n${f.bullets.map((b) => `- ${b}`).join('\n')}`)
      .join('\n\n')}`,
    employmentType: 'CONTRACTOR',
    hiringOrganization: {
      '@type': 'Organization',
      name: 'The Worx',
      sameAs: 'https://theworx.io',
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Port of Spain',
        addressCountry: 'TT',
      },
    },
    baseSalary: {
      '@type': 'MonetaryAmount',
      currency: 'TTD',
      value: {
        '@type': 'QuantitativeValue',
        value: 7500,
        unitText: 'MONTH',
      },
    },
    applicantLocationRequirements: {
      '@type': 'Country',
      name: 'Trinidad and Tobago',
    },
    directApply: false,
    datePosted: '2026-05-12',
  }
}

export default async function JobDetailPage({ params }: PageProps) {
  const { slug } = await params
  const job = getJob(slug)
  if (!job) notFound()

  // Filled roles keep their URL alive (old links, search results) but
  // show a closed notice instead of the posting.
  if (job.closedAt) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 md:py-24 text-center">
        <p className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-2">
          Position filled
        </p>
        <h1 className="font-heading text-3xl md:text-4xl mb-4">{job.title}</h1>
        <p className="text-neutral-600 mb-8">
          This role has been filled — thanks to everyone who applied. Keep an
          eye on our open roles; the next opportunity might be yours.
        </p>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1 text-sm font-medium text-turquoise-700 hover:text-turquoise-900 underline"
        >
          See open roles
        </Link>
      </div>
    )
  }

  const jsonLd = jobPostingJsonLd(job)
  const applySubject = encodeURIComponent(`Application: ${job.title}`)
  const mailtoHref = `mailto:${job.applyEmail}?subject=${applySubject}`

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-6"
      >
        <ChevronLeft size={16} />
        All open roles
      </Link>

      <header className="mb-10">
        <p className="text-sm font-medium text-turquoise-700 uppercase tracking-wide mb-2">
          We&apos;re hiring
        </p>
        <h1 className="font-heading text-4xl md:text-5xl mb-4">{job.title}.</h1>
        <p className="text-lg text-neutral-600 max-w-2xl mb-6">
          {job.roleSummary}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge color="darkBlue">{job.contractType}</Badge>
          <Badge color="neutral">{job.location.split(',')[0]}</Badge>
          {job.salary && <Badge color="red">{job.salary}</Badge>}
          <Badge color="turquoise">{job.hours}</Badge>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <FactCard
          icon={<MapPin size={16} />}
          label="Location"
          value={job.location}
        />
        <FactCard
          icon={<Clock size={16} />}
          label="Terms"
          value={`${job.contractType}, ${job.hours}`}
        />
        <FactCard
          icon={<Briefcase size={16} />}
          label="Reports to"
          value={job.reportsTo}
        />
      </section>

      <Section title="About The Worx">
        <p className="text-neutral-700 leading-relaxed">{job.about}</p>
      </Section>

      <Section title="Tools you'll use">
        <div className="flex flex-wrap gap-2">
          {job.toolsUsed.map((t) => (
            <span
              key={t}
              className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md bg-neutral-100 text-neutral-800"
            >
              {t}
            </span>
          ))}
        </div>
      </Section>

      <Section title="The ideal candidate">
        <p className="text-neutral-600 mb-4">
          We&apos;re looking for someone who:
        </p>
        <dl className="divide-y divide-neutral-100 border-y border-neutral-100">
          {job.idealCandidate.map((c) => (
            <div
              key={c.trait}
              className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 md:gap-6 py-4"
            >
              <dt className="font-heading text-base">{c.trait}</dt>
              <dd className="text-neutral-700">{c.description}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Core focus areas">
        <div className="space-y-8">
          {job.focusAreas.map((area) => (
            <article key={area.number}>
              <div className="flex items-baseline gap-4 mb-3">
                <span className="font-heading text-3xl md:text-4xl text-neutral-300 leading-none">
                  {area.number}
                </span>
                <h3 className="font-heading text-xl md:text-2xl">
                  {area.title}
                </h3>
              </div>
              <ul className="space-y-2 pl-12">
                {area.bullets.map((b, i) => (
                  <li
                    key={i}
                    className="text-neutral-700 leading-relaxed relative pl-4 before:content-[''] before:absolute before:left-0 before:top-2.5 before:w-1.5 before:h-1.5 before:bg-turquoise-500 before:rounded-sm"
                  >
                    {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <section className="bg-turquoise-50 border border-turquoise-100 rounded-lg p-6 md:p-8 mb-10">
        <h2 className="font-heading text-xl md:text-2xl mb-3">
          Why join The Worx?
        </h2>
        {job.whyJoin.map((p, i) => (
          <p
            key={i}
            className="text-neutral-700 leading-relaxed mb-3 last:mb-0"
          >
            {p}
          </p>
        ))}
      </section>

      <section className="bg-neutral-900 text-white rounded-lg p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl md:text-2xl mb-1">
            Ready to apply?
          </h2>
          <p className="text-neutral-300 text-sm">{job.applyNote}</p>
        </div>
        <a
          href={mailtoHref}
          className="inline-flex items-center gap-2 px-5 py-3 bg-turquoise-500 hover:bg-turquoise-600 text-white font-medium rounded-md transition whitespace-nowrap"
        >
          Email your resume
          <ArrowRight size={16} />
        </a>
      </section>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <h2 className="font-heading text-xl md:text-2xl mb-4 pb-2 border-b border-neutral-200">
        {title}
      </h2>
      {children}
    </section>
  )
}

function FactCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-500 mb-1">
        {icon}
        {label}
      </div>
      <p className="font-medium">{value}</p>
    </div>
  )
}

const BADGE_STYLES: Record<string, string> = {
  darkBlue: 'bg-darkBlue-900 text-white',
  neutral: 'border border-neutral-300 text-neutral-800',
  red: 'bg-red-500 text-white',
  turquoise: 'bg-turquoise-200 text-darkBlue-900',
}

function Badge({
  color,
  children,
}: {
  color: keyof typeof BADGE_STYLES
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded ${BADGE_STYLES[color]}`}
    >
      {children}
    </span>
  )
}
