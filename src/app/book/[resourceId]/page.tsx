import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { needsOnboarding } from '@/lib/auth/onboarding'
import { memberAccess } from '@/lib/gym/entitlement'
import { loadGymSettings } from '@/lib/gym/settings'
import { cancelOutcome } from '@/lib/gym/rules'
import { parseTstzRange } from '@/lib/booking/slots'
import {
  bookingDayKeys,
  isPtResourceId,
  loadPtResource,
  loadPtResources,
  loadWindowSlots,
  reservedPtCount,
  summarizeDays,
} from '@/lib/booking/pt'
import { fmtAstTime, fmtAstWeekdayDate } from '@/lib/time/ast'
import PtBookingClient from '@/components/booking/pt-booking-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ resourceId: string }>
  searchParams: Promise<{ date?: string; reschedule?: string }>
}

export default async function BookCoachPage({ params, searchParams }: PageProps) {
  const { resourceId } = await params
  const { date: rawDate, reschedule: rescheduleId } = await searchParams
  if (!isPtResourceId(resourceId)) notFound()

  const user = await getCurrentUser()
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/book/${resourceId}`)}`)
  }
  if (needsOnboarding(user)) {
    redirect(`/welcome?next=${encodeURIComponent(`/book/${resourceId}`)}`)
  }

  const admin = createAdminClient()
  const [resource, all, access, reserved, settings] = await Promise.all([
    loadPtResource(admin, resourceId),
    loadPtResources(admin),
    memberAccess(admin, user.id),
    reservedPtCount(admin, user.id),
    loadGymSettings(admin),
  ])
  if (!resource) notFound()

  const keys = bookingDayKeys()
  const date = rawDate && keys.includes(rawDate) ? rawDate : keys[0]
  const slotsByDay = await loadWindowSlots(admin, resource, user.id)

  // Reschedule context: only the member's own confirmed PT booking.
  let reschedule = null
  if (rescheduleId && /^[0-9a-f-]{36}$/.test(rescheduleId)) {
    const { data } = await admin
      .from('bookings')
      .select('id, user_id, status, during, checked_in_at, resources(name)')
      .eq('id', rescheduleId)
      .maybeSingle()
    const row = data as {
      id: string
      user_id: string | null
      status: string
      during: string
      checked_in_at: string | null
      resources: { name?: string } | { name?: string }[] | null
    } | null
    const range = row ? parseTstzRange(row.during) : null
    if (
      row &&
      range &&
      row.user_id === user.id &&
      row.status === 'confirmed' &&
      !row.checked_in_at
    ) {
      const resRaw = row.resources
      const coach = (Array.isArray(resRaw) ? resRaw[0]?.name : resRaw?.name) ?? 'PT'
      reschedule = {
        bookingId: row.id,
        label: `${coach} · ${fmtAstWeekdayDate(range.during_lower)} ${fmtAstTime(range.during_lower)}`,
        outcome: cancelOutcome(range.during_lower, settings),
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
      <PtBookingClient
        resourceId={resource.id}
        coachName={resource.coach?.displayName ?? resource.name}
        coachBio={resource.coach?.bio ?? null}
        capacity={resource.capacity}
        tabs={all.map((r) => ({
          resourceId: r.id,
          name: r.coach?.displayName ?? r.name,
          slug: r.coach?.slug ?? r.id,
        }))}
        days={summarizeDays(slotsByDay)}
        initialDate={date}
        initialSlots={slotsByDay.get(date) ?? []}
        ptLeft={access.ptUnlimited ? null : access.ptBalance}
        reservedCount={reserved}
        reschedule={reschedule}
      />
    </div>
  )
}
