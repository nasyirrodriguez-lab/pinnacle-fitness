import { createAdminClient } from '@/utils/supabase/admin'
import FeedbackManager, {
  type FeedbackFormRow,
} from '@/components/admin/feedback-manager'

export const dynamic = 'force-dynamic'
// Emailing the whole membership runs at ~4/sec.
export const maxDuration = 300

export const metadata = {
  title: 'Feedback — Admin',
}

async function loadForms(): Promise<FeedbackFormRow[]> {
  const admin = createAdminClient()
  const [{ data: forms }, { data: responses }] = await Promise.all([
    admin
      .from('feedback_forms')
      .select('id, title, is_open, sent_at, created_at')
      .order('created_at', { ascending: false }),
    admin.from('feedback_responses').select('form_id'),
  ])
  const counts = new Map<string, number>()
  for (const r of (responses as { form_id: string }[] | null) ?? []) {
    counts.set(r.form_id, (counts.get(r.form_id) ?? 0) + 1)
  }
  return ((forms as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    isOpen: (r.is_open as boolean) ?? false,
    sentAt: (r.sent_at as string | null) ?? null,
    createdAt: r.created_at as string,
    responseCount: counts.get(r.id as string) ?? 0,
  }))
}

export default async function AdminFeedbackPage() {
  const forms = await loadForms()

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Member feedback</h1>
        <p className="text-neutral-600 max-w-2xl">
          Build a short feedback form, email it to the whole membership each
          quarter, and read the responses here.
        </p>
      </div>
      <FeedbackManager forms={forms} />
    </div>
  )
}
