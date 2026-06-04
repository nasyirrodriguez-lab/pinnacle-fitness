import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import HomeLogoButton from '@/components/dashboard/HomeLogoButton'
import ClassSchedule from '@/components/classes/ClassSchedule'
import type { GymClass, Booking } from '@/lib/types'

export default async function ClassesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!member) redirect('/dashboard')

  // Fetch all classes + member's bookings in parallel
  const [{ data: classes }, { data: bookings }, bookingCountsRes] = await Promise.all([
    supabase.from('classes').select('*').order('day_of_week').order('start_time'),
    supabase
      .from('bookings')
      .select('*')
      .eq('member_id', member.id),
    supabase
      .from('bookings')
      .select('class_id, count:id')
      .eq('status', 'confirmed'),
  ])

  const allClasses = (classes ?? []) as GymClass[]
  const myBookings = (bookings ?? []) as Booking[]

  // Build a set of class IDs the member has confirmed bookings for
  const bookedClassIds = new Set(
    myBookings.filter((b) => b.status === 'confirmed').map((b) => b.class_id)
  )
  const bookingIdByClassId: Record<string, string> = {}
  for (const b of myBookings) {
    if (b.status === 'confirmed') bookingIdByClassId[b.class_id] = b.id
  }

  // Confirmed booking counts per class
  const spotsByClassId: Record<string, number> = {}
  if (bookingCountsRes.data) {
    for (const row of bookingCountsRes.data as { class_id: string; count: number }[]) {
      spotsByClassId[row.class_id] = Number(row.count)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <header className="border-b border-[#E8E3D9] bg-[#F5F0E8]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <HomeLogoButton />
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-xs text-[#6B6560] hover:text-[#1C1A17] transition">
              Dashboard
            </Link>
            <Link href="/dashboard/payments" className="text-xs text-[#6B6560] hover:text-[#1C1A17] transition">
              Billing
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-10">
          <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-2">
            Pinnacle GYM
          </p>
          <h1 className="font-serif text-4xl text-[#1C1A17]">Class Schedule</h1>
          <p className="text-[#6B6560] mt-2">Book your weekly classes. Cancel anytime before the session.</p>
        </div>

        <ClassSchedule
          classes={allClasses}
          bookings={myBookings}
          bookedClassIds={bookedClassIds}
          bookingIdByClassId={bookingIdByClassId}
          spotsByClassId={spotsByClassId}
        />
      </main>
    </div>
  )
}
