import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { fmtAstDateTime } from '@/lib/time/ast'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Feedback responses — Admin',
}

interface PageProps {
  params: Promise<{ id: string }>
}

interface Question {
  prompt: string
  type: 'text' | 'rating'
}

export default async function AdminFeedbackDetailPage({ params }: PageProps) {
  const { id } = await params
  const admin = createAdminClient()

  const [{ data: formRaw }, { data: responsesRaw }] = await Promise.all([
    admin
      .from('feedback_forms')
      .select('id, title, intro, questions, is_open, sent_at')
      .eq('id', id)
      .maybeSingle(),
    admin
      .from('feedback_responses')
      .select(
        'id, answers, created_at, profiles!feedback_responses_user_id_fkey(full_name, email)'
      )
      .eq('form_id', id)
      .order('created_at', { ascending: false }),
  ])
  if (!formRaw) notFound()
  const form = formRaw as {
    id: string
    title: string
    intro: string | null
    questions: unknown
    is_open: boolean
  }
  const questions = (
    Array.isArray(form.questions) ? form.questions : []
  ) as Question[]

  const responses = (
    (responsesRaw as Record<string, unknown>[] | null) ?? []
  ).map((r) => {
    const profRaw = r.profiles as
      | { full_name?: string | null; email?: string }
      | { full_name?: string | null; email?: string }[]
      | null
    const profile = Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw
    return {
      id: r.id as string,
      answers: (Array.isArray(r.answers) ? r.answers : []) as (
        | string
        | number
        | null
      )[],
      createdAt: r.created_at as string,
      memberName: profile?.full_name?.trim() || profile?.email || 'Member',
    }
  })

  // Average per rating question.
  const ratingAverages = questions.map((q, i) => {
    if (q.type !== 'rating') return null
    const values = responses
      .map((r) => Number(r.answers[i]))
      .filter((v) => Number.isFinite(v) && v >= 1 && v <= 5)
    if (values.length === 0) return null
    return values.reduce((s, v) => s + v, 0) / values.length
  })

  return (
    <div>
      <Link
        href="/admin/feedback"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ChevronLeft size={16} />
        Feedback
      </Link>

      <div className="mb-6">
        <h1 className="font-heading text-2xl md:text-3xl mb-1">{form.title}</h1>
        <p className="text-neutral-600">
          {responses.length} response{responses.length === 1 ? '' : 's'}
          {!form.is_open && ' · closed'}
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
        <h2 className="font-heading text-lg mb-3">Questions</h2>
        <ol className="list-decimal pl-5 space-y-1 text-sm">
          {questions.map((q, i) => (
            <li key={i}>
              {q.prompt}
              {q.type === 'rating' && (
                <span className="text-neutral-500">
                  {' '}
                  · rating 1–5
                  {ratingAverages[i] != null &&
                    ` · average ${ratingAverages[i]!.toFixed(1)}`}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      {responses.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-10 text-center text-neutral-500 text-sm">
          No responses yet.
        </div>
      ) : (
        <ul className="space-y-4">
          {responses.map((r) => (
            <li
              key={r.id}
              className="bg-white border border-neutral-200 rounded-lg p-5"
            >
              <p className="text-sm font-medium mb-2">
                {r.memberName}
                <span className="text-xs text-neutral-500 font-normal">
                  {' '}
                  · {fmtAstDateTime(r.createdAt)}
                </span>
              </p>
              <dl className="space-y-2 text-sm">
                {questions.map((q, i) => (
                  <div key={i}>
                    <dt className="text-neutral-500">{q.prompt}</dt>
                    <dd className="whitespace-pre-line">
                      {q.type === 'rating'
                        ? `${r.answers[i] ?? '—'} / 5`
                        : r.answers[i] || '—'}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
