'use client'

import { useState } from 'react'
import type { Member, CheckIn, Payment, OverviewStats } from '@/lib/types'
import OverviewSection from './OverviewSection'
import MembersSection from './MembersSection'
import CheckInsSection from './CheckInsSection'
import RevenueSection from './RevenueSection'
import FreeTrialSection from './FreeTrialSection'

interface FreeTrialBooking {
  id: string
  name: string
  email: string
  phone: string
  class_name: string
  class_day: string
  class_time: string
  created_at: string
}

type Tab = 'overview' | 'members' | 'checkins' | 'revenue' | 'freetrial'

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'members',
    label: 'Members',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'checkins',
    label: 'Check-Ins',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'revenue',
    label: 'Revenue',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'freetrial',
    label: 'Free Trials',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    ),
  },
]

interface Props {
  stats: OverviewStats
  members: Member[]
  checkIns: CheckIn[]
  payments: Payment[]
  freeTrialBookings: FreeTrialBooking[]
}

export default function AdminDashboard({ stats, members, checkIns, payments, freeTrialBookings }: Props) {
  const [active, setActive] = useState<Tab>('overview')

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="flex flex-col md:flex-row">
        <aside className="md:w-52 md:min-h-screen md:border-r border-b md:border-b-0 border-zinc-800 bg-zinc-900/50 flex-shrink-0">
          <nav className="flex md:flex-col gap-1 p-3 overflow-x-auto md:overflow-x-visible md:pt-6">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-all flex-shrink-0 ${
                  active === t.id
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {t.icon}
                {t.label}
                {t.id === 'freetrial' && freeTrialBookings.length > 0 && (
                  <span className="ml-auto bg-orange-500/20 text-orange-400 text-xs px-1.5 py-0.5 rounded-full">
                    {freeTrialBookings.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 p-5 md:p-8">
          {active === 'overview' && <OverviewSection stats={stats} />}
          {active === 'members' && <MembersSection initialMembers={members} />}
          {active === 'checkins' && <CheckInsSection initialCheckIns={checkIns} />}
          {active === 'revenue' && <RevenueSection payments={payments} />}
          {active === 'freetrial' && <FreeTrialSection bookings={freeTrialBookings} />}
        </main>
      </div>
    </div>
  )
}
