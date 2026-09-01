import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import HomeLogoButton from '@/components/dashboard/HomeLogoButton'

export default async function ClassesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

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
          <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-2">Pinnacle Fitness</p>
          <h1 className="font-serif text-4xl text-[#1C1A17]">Class Schedule</h1>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E3D9] p-16 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-[#C85C2D]/10 flex items-center justify-center mb-5">
            <svg className="w-7 h-7 text-[#C85C2D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl text-[#1C1A17] mb-2">Coming Soon</h2>
          <p className="text-[#6B6560] text-sm max-w-xs">
            Online class booking is on the way. In the meantime, speak to a coach to reserve your spot.
          </p>
        </div>
      </main>
    </div>
  )
}
