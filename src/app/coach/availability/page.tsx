import { requireCoach } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/utils/supabase/admin'
import CoachAvailabilityEditor, { type BlockRow, type WindowRow } from '@/components/admin/coach-availability-editor'

export const metadata = { title: 'Availability — Coach' }

export default async function CoachAvailabilityPage() {
  const coach = await requireCoach()
  const admin = createAdminClient()
  const [{ data: windows }, { data: blocks }] = await Promise.all([
    admin.from('coach_availability').select('weekday, start_minute, end_minute').eq('coach_id', coach.coachId).order('weekday').order('start_minute'),
    admin.from('coach_blocks').select('id, starts_at, ends_at, reason').eq('coach_id', coach.coachId).gte('ends_at', new Date().toISOString()).order('starts_at'),
  ])
  const windowRows: WindowRow[] = ((windows as { weekday: number; start_minute: number; end_minute: number }[] | null) ?? []).map((w) => ({
    weekday: w.weekday, startMinute: w.start_minute, endMinute: w.end_minute,
  }))
  const blockRows: BlockRow[] = ((blocks as { id: string; starts_at: string; ends_at: string; reason: string | null }[] | null) ?? []).map((b) => ({
    id: b.id, startsAt: b.starts_at, endsAt: b.ends_at, reason: b.reason,
  }))
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Availability</h1>
        <p className="text-neutral-600">The gym is open Mon–Fri 5:30 AM–7:00 PM, Sat 7:00 AM–1:00 PM. Set the hours you coach inside that.</p>
      </div>
      <CoachAvailabilityEditor windows={windowRows} blocks={blockRows} />
    </div>
  )
}
