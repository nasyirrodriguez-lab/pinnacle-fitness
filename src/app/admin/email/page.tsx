import { createAdminClient } from '@/utils/supabase/admin'
import { fmtAstDateTime } from '@/lib/time/ast'
import BroadcastForm from '@/components/admin/broadcast-form'

export const dynamic = 'force-dynamic'

interface SentRow {
  id: string
  subject: string
  template: string
  status: string
  sentAt: string
  toEmail: string
}

async function loadRecentSends(): Promise<{
  recent: SentRow[]
  recentTemplateCounts: Record<
    string,
    { sent: number; failed: number; last: string }
  >
}> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_log')
    .select('id, subject, template, status, sent_at, to_email')
    .like('template', 'broadcast:%')
    .order('sent_at', { ascending: false })
    .limit(500)
  if (error || !data) {
    return { recent: [], recentTemplateCounts: {} }
  }

  const recent: SentRow[] = (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    subject: r.subject as string,
    template: r.template as string,
    status: r.status as string,
    sentAt: r.sent_at as string,
    toEmail: r.to_email as string,
  }))

  const counts: Record<string, { sent: number; failed: number; last: string }> =
    {}
  for (const row of recent) {
    const key = row.template
    if (!counts[key]) {
      counts[key] = { sent: 0, failed: 0, last: row.sentAt }
    }
    if (row.status === 'sent') counts[key].sent++
    else if (row.status === 'failed') counts[key].failed++
    if (row.sentAt > counts[key].last) counts[key].last = row.sentAt
  }

  return { recent, recentTemplateCounts: counts }
}

function fmtDateTime(iso: string): string {
  return fmtAstDateTime(iso)
}

export default async function AdminEmailPage() {
  const { recentTemplateCounts } = await loadRecentSends()
  const recentSummary = Object.entries(recentTemplateCounts)
    .map(([template, stats]) => ({
      subject: template.replace(/^broadcast:/, ''),
      sent: stats.sent,
      failed: stats.failed,
      last: stats.last,
    }))
    .sort((a, b) => b.last.localeCompare(a.last))
    .slice(0, 10)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Broadcast email</h1>
        <p className="text-neutral-600">
          Send to all active members. Unsubscribed addresses are skipped
          automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <BroadcastForm />
        </div>

        <aside>
          <div className="bg-white border border-neutral-200 rounded-lg p-5">
            <h2 className="font-heading text-base mb-3">Recent broadcasts</h2>
            {recentSummary.length === 0 ? (
              <p className="text-sm text-neutral-500">None sent yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentSummary.map((r) => (
                  <li
                    key={r.subject}
                    className="text-sm border-b border-neutral-100 last:border-0 pb-3 last:pb-0"
                  >
                    <p className="font-medium truncate">{r.subject}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {r.sent} sent
                      {r.failed > 0 && ` · ${r.failed} failed`} ·{' '}
                      {fmtDateTime(r.last)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-900">
            <p className="font-medium mb-1">Sending guidance</p>
            <ul className="space-y-1 list-disc pl-4">
              <li>Sends one batch every ~1 second to avoid Resend limits.</li>
              <li>
                A subject can only be sent once per recipient — re-sending the
                same subject skips already-delivered addresses.
              </li>
              <li>
                Every email includes an unsubscribe link. Unsubscribed addresses
                are skipped in future sends.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
