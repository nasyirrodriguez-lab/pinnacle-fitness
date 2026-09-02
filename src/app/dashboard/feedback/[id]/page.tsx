import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createAdminClient } from '@/utils/supabase/admin'
import FeedbackForm from '@/components/dashboard/feedback-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Feedback — Pinnacle Fitness',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ id: string }>
}

interface Question {
  prompt: string
  type: 'text' | 'rating'
}

export default async function MemberFeedbackPage({ params }: PageProps) {
  const user = await getCurrentUser()
  const { id } = await params
  if (!user)
    redirect(`/sign-in?next=${encodeURIComponent(`/dashboard/feedback/${id}`)}`)

  const admin = createAdminClient()
  const [{ data: formRaw }, { data: existing }] = await Promise.all([
    admin
      .from('feedback_forms')
      .select('id, title, intro, questions, is_open')
      .eq('id', id)
      .maybeSingle(),
    admin
      .from('feedback_responses')
      .select('answers')
      .eq('form_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])
  if (!formRaw) notFound()
  const form = formRaw as {
    id: string
    title: string
    intro: string | null
    questions: unknown
    is_open: boolean
  }
  if (!form.is_open) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-heading text-2xl mb-2">{form.title}</h1>
        <p className="text-neutral-600">
          This feedback round has closed — thanks to everyone who shared their
          thoughts.
        </p>
      </div>
    )
  }
  const questions = (
    Array.isArray(form.questions) ? form.questions : []
  ) as Question[]

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-heading text-2xl md:text-3xl mb-2">{form.title}</h1>
        <p className="text-neutral-600">
          {form.intro ??
            'A few quick questions — it takes about two minutes and genuinely shapes what we do next.'}
        </p>
      </div>
      <FeedbackForm
        formId={form.id}
        questions={questions}
        existingAnswers={
          (existing as { answers?: (string | number | null)[] } | null)
            ?.answers ?? null
        }
      />
    </div>
  )
}
