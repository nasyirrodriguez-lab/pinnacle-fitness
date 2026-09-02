import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, MapPin, Clock } from 'lucide-react'
import { getOpenJobs } from '@/config/jobs'

export const metadata: Metadata = {
  title: 'Jobs at The Worx | Coworking Space, Port of Spain',
  description:
    'Open roles at The Worx coworking space in Port of Spain, Trinidad and Tobago. Join a community-first team helping entrepreneurs grow.',
  alternates: { canonical: '/jobs' },
  openGraph: {
    title: 'Jobs at The Worx',
    description:
      'Open roles at The Worx coworking space in Port of Spain, Trinidad and Tobago.',
    url: '/jobs',
    type: 'website',
  },
}

export default function JobsIndexPage() {
  const jobs = getOpenJobs()

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
      <div className="mb-12">
        <p className="text-sm font-medium text-turquoise-700 uppercase tracking-wide mb-2">
          We&apos;re hiring
        </p>
        <h1 className="font-heading text-4xl md:text-5xl mb-4">
          Work with us at The Worx.
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl">
          We&apos;re building an entrepreneurial community in Port of Spain. If
          that excites you, we&apos;d love to meet.
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
          <h2 className="font-heading text-xl mb-2">No open roles right now</h2>
          <p className="text-neutral-600 mb-4">
            We&apos;re always interested in great people. Send your resume and
            we&apos;ll keep you in mind.
          </p>
          <a
            href="mailto:team@theworx.io"
            className="text-turquoise-700 underline font-medium"
          >
            team@theworx.io
          </a>
        </div>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.slug}>
              <Link
                href={`/jobs/${job.slug}`}
                className="group block bg-white border border-neutral-200 rounded-lg p-6 hover:border-turquoise-500 hover:shadow-sm transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-heading text-xl md:text-2xl mb-2 group-hover:text-turquoise-700 transition">
                      {job.title}
                    </h2>
                    <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} />
                        {job.location}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={14} />
                        {job.contractType}
                      </span>
                      {job.salary && (
                        <span className="font-medium text-neutral-900">
                          {job.salary}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight
                    size={20}
                    className="text-neutral-400 group-hover:text-turquoise-600 group-hover:translate-x-0.5 transition mt-1"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
