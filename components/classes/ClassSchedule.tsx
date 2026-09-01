'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import type { GymClass, Booking } from '@/lib/types'

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}
const TODAY_NAME = DAY_ORDER[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

interface Props {
  classes: GymClass[]
  bookings: Booking[]
  bookedClassIds: Set<string>
  bookingIdByClassId: Record<string, string>
  spotsByClassId: Record<string, number>
}

export default function ClassSchedule({
  classes,
  bookings: initialBookings,
  bookedClassIds: initialBooked,
  bookingIdByClassId: initialBookingIds,
  spotsByClassId,
}: Props) {
  const [bookings, setBookings] = useState(initialBookings)
  const [bookedIds, setBookedIds] = useState(initialBooked)
  const [bookingIdMap, setBookingIdMap] = useState(initialBookingIds)
  const [loading, setLoading] = useState<string | null>(null)

  // My upcoming bookings (confirmed)
  const myBookings = bookings.filter((b) => b.status === 'confirmed')
  const myBookingClasses = myBookings
    .map((b) => classes.find((c) => c.id === b.class_id))
    .filter(Boolean) as GymClass[]

  async function handleBook(classId: string) {
    const gymClass = classes.find((c) => c.id === classId)
    setLoading(classId)
    const res = await fetch('/api/classes/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId }),
    })
    if (res.ok) {
      setBookedIds((prev) => new Set([...prev, classId]))
      toast.success(`Class booked! See you at ${gymClass?.name ?? 'class'}.`)
    } else {
      const { error: msg } = await res.json()
      toast.error(msg || 'Failed to book class. Please try again.')
    }
    setLoading(null)
  }

  async function handleCancel(classId: string) {
    const bookingId = bookingIdMap[classId]
    if (!bookingId) return
    setLoading(classId)
    const res = await fetch('/api/classes/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId }),
    })
    if (res.ok) {
      setBookedIds((prev) => {
        const next = new Set(prev)
        next.delete(classId)
        return next
      })
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' as const } : b))
      )
      toast('Booking cancelled.', {
        icon: '○',
        style: { borderColor: '#54504A30', color: '#54504A' },
      })
    } else {
      const { error: msg } = await res.json()
      toast.error(msg || 'Failed to cancel. Please try again.')
    }
    setLoading(null)
  }

  // Group classes by day_of_week string
  const byDay: Record<string, GymClass[]> = {}
  for (const c of classes) {
    const key = String(c.day_of_week)
    if (!byDay[key]) byDay[key] = []
    byDay[key].push(c)
  }
  for (const day in byDay) {
    byDay[day].sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  return (
    <div className="space-y-10">
      {/* My Bookings */}
      <section>
        <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">My Upcoming Classes</p>
        {myBookingClasses.length === 0 ? (
          <div className="bg-white border border-[#C4C1BA] rounded-2xl p-6 text-center text-[#6B6560] text-sm">
            No classes booked yet. Browse the schedule below.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myBookingClasses.map((c) => (
              <div key={c.id} className="bg-white border border-[#54504A]/30 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-[#1C1A17]">{c.name}</p>
                    <p className="text-xs text-[#6B6560] mt-0.5">{c.coach_name}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-[#54504A]/10 text-[#54504A] rounded-full font-medium">
                    {DAY_SHORT[c.day_of_week] ?? c.day_of_week}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#6B6560] mb-4">
                  <span>{formatTime(c.start_time)}</span>
                  <span>·</span>
                  <span>{c.duration_min} min</span>
                  <span>·</span>
                  <span>{c.location}</span>
                </div>
                <button
                  onClick={() => handleCancel(c.id)}
                  disabled={loading === c.id}
                  className="w-full py-2 text-xs font-medium text-[#6B6560] border border-[#C4C1BA] rounded-full hover:border-red-300 hover:text-red-500 transition disabled:opacity-50"
                >
                  {loading === c.id ? 'Cancelling…' : 'Cancel Booking'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Weekly Schedule */}
      <section>
        <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">Weekly Schedule</p>
        <div className="space-y-6">
          {DAY_ORDER.map((dayName) => {
            const dayCls = byDay[dayName]
            if (!dayCls || dayCls.length === 0) return null
            const isToday = dayName === TODAY_NAME
            return (
              <div key={dayName}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className={`font-serif text-lg ${isToday ? 'text-[#54504A]' : 'text-[#1C1A17]'}`}>
                    {dayName}
                  </h2>
                  {isToday && (
                    <span className="text-xs px-2 py-0.5 bg-[#54504A]/10 text-[#54504A] rounded-full font-medium">
                      Today
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dayCls.map((c) => {
                    const isBooked = bookedIds.has(c.id)
                    const spots = spotsByClassId[c.id] ?? 0
                    const spotsLeft = c.max_spots - spots
                    const full = spotsLeft <= 0
                    return (
                      <div
                        key={c.id}
                        className={`bg-white border rounded-2xl p-5 flex flex-col gap-4 ${
                          isBooked ? 'border-[#1F3D2B]/30' : 'border-[#C4C1BA]'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-[#1C1A17]">{c.name}</p>
                            <p className="text-xs text-[#6B6560] mt-0.5">{c.coach_name}</p>
                          </div>
                          {isBooked && (
                            <span className="text-xs px-2 py-1 bg-[#1F3D2B]/10 text-[#1F3D2B] rounded-full font-medium whitespace-nowrap">
                              Booked
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-[#6B6560]">
                          <div>
                            <p className="uppercase tracking-[0.1em] text-[10px] mb-0.5">Time</p>
                            <p className="text-[#1C1A17] font-medium">{formatTime(c.start_time)}</p>
                          </div>
                          <div>
                            <p className="uppercase tracking-[0.1em] text-[10px] mb-0.5">Duration</p>
                            <p className="text-[#1C1A17] font-medium">{c.duration_min} min</p>
                          </div>
                          <div>
                            <p className="uppercase tracking-[0.1em] text-[10px] mb-0.5">Location</p>
                            <p className="text-[#1C1A17] font-medium">{c.location}</p>
                          </div>
                          <div>
                            <p className="uppercase tracking-[0.1em] text-[10px] mb-0.5">Spots Left</p>
                            <p className={`font-medium ${spotsLeft <= 3 ? 'text-[#54504A]' : 'text-[#1C1A17]'}`}>
                              {full ? 'Full' : `${spotsLeft} / ${c.max_spots}`}
                            </p>
                          </div>
                        </div>

                        {isBooked ? (
                          <button
                            onClick={() => handleCancel(c.id)}
                            disabled={loading === c.id}
                            className="mt-auto py-2.5 text-xs font-medium text-[#6B6560] border border-[#C4C1BA] rounded-full hover:border-red-300 hover:text-red-500 transition disabled:opacity-50"
                          >
                            {loading === c.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBook(c.id)}
                            disabled={loading === c.id || full}
                            className="mt-auto py-2.5 text-xs font-medium bg-[#54504A] text-white rounded-full hover:bg-[#3d3a35] transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {loading === c.id ? 'Booking…' : full ? 'Class Full' : 'Book Class'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
