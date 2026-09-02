import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, Users } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { floorStatus } from '@/lib/gym/floor'
import { memberAccess } from '@/lib/gym/entitlement'
import {
  loadPtResources,
  loadWindowSlots,
  nextAvailableSlot,
} from '@/lib/booking/pt'
import { fmtAstTime, fmtAstWeekdayDate } from '@/lib/time/ast'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Book — Pinnacle Fitness',
  description: 'Book a small-group PT session with Nasyir or Matthew.',
}

export default async function BookIndexPage() {
  const admin = createAdminClient()
  const user = await getCurrentUser()
  const [resources, floor, access] = await Promise.all([
    loadPtResources(admin),
    floorStatus(admin),
    user ? memberAccess(admin, user.id) : null,
  ])
  const nextByResource = await Promise.all(
    resources.map(async (r) =>
      nextAvailableSlot(await loadWindowSlots(admin, r, user?.id ?? null))
    )
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2">
        Book
      </p>
      <h1 className="font-heading text-4xl md:text-5xl mb-2">Who are you training with?</h1>
      <p className="text-muted-foreground mb-8 max-w-xl">
        Small-group PT, one hour, coached. Booking holds your spot; the
        session is used when you scan in.
      </p>

      {access && (
        <div className="mb-6 bg-card border border-border rounded-[22px] px-5 py-4 flex items-center gap-4">
          <span className="font-stat text-4xl text-primary">
            {access.ptUnlimited ? '∞' : access.ptBalance}
          </span>
          <div className="text-sm">
            <p className="font-semibold">
              {access.ptUnlimited ? 'Unlimited PT' : 'PT sessions left'}
            </p>
            <p className="text-muted-foreground">
              {access.plan ? access.plan.name : 'No plan yet'}
              {access.periodEnd && ` · renews ${fmtAstWeekdayDate(access.periodEnd)}`}
            </p>
          </div>
        </div>
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {resources.map((r, i) => {
          const next = nextByResource[i]
          return (
            <li key={r.id}>
              <Link
                href={user ? `/book/${r.id}` : `/sign-in?next=${encodeURIComponent(`/book/${r.id}`)}`}
                className="group flex flex-col h-full bg-card border border-border rounded-[22px] p-6 hover:border-primary transition"
              >
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2">
                  PT · up to {r.capacity}
                </p>
                <h2 className="font-heading text-3xl mb-3">
                  {r.coach?.displayName ?? r.name}
                </h2>
                <p className="text-sm text-muted-foreground mb-6 line-clamp-3">
                  {r.coach?.bio ?? ''}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3">
                  <span className="text-sm">
                    {next ? (
                      <>
                        Next:{' '}
                        <span className="font-stat text-lg text-primary">
                          {fmtAstWeekdayDate(next.startIso)} {fmtAstTime(next.startIso)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Nothing open this fortnight</span>
                    )}
                  </span>
                  <ArrowRight
                    size={18}
                    className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition shrink-0"
                  />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="mt-6 bg-card border border-border rounded-[22px] p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
          <Users size={20} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Open gym isn&apos;t booked</p>
          <p className="text-sm text-muted-foreground">
            Come in during opening hours and scan in at the iPad. Right now{' '}
            <span className="font-stat text-lg text-foreground">
              {floor.onFloor} of {floor.cap}
            </span>{' '}
            on the floor.
          </p>
        </div>
      </div>

      {!user && (
        <p className="mt-8 text-sm text-muted-foreground">
          Not a member yet?{' '}
          <Link href="/apply" className="underline">
            Apply to join
          </Link>
          .
        </p>
      )}
    </div>
  )
}
