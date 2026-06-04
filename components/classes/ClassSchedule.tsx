'use client'

import { useState } from 'react'
import type { GymClass, Booking } from '@/lib/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
  const [error, setError] = useState('')

  // Today's day index for highlighting
  const todayIdx = new Date().getDay()

  // My upcoming bookings (confirmed, sorted by day)
  const myBookings = bookings.filter((b) => b.status === 'confirmed')
  const myBookingClasses = myBookings
    .map((b) => classes.find((c) => c.id === b.class_id))
    .filter(Boolean) as GymClass[]

  async function handleBook(classId: string) {
    setLoading(classId)
    setError('')
    const res = await fetch('/api/classes/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId }),
    })
    if (res.ok) {
      const data = await res.json()
      // Optimistically mark as booked
      setBookedIds((prev) => new Set([...prev, classId]))
    } else {
      const { error: msg } = await res.json()
      setError(msg || 'Failed to book class')
    }
    setLoading(null)
  }

  async function handleCancel(classId: string) {
    const bookingId = bookingIdMap[classId]
    if (!bookingId) return
    setLoading(classId)
    setError('')
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
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
      )
    } else {
      const { error: msg } = await res.json()
      setError(msg || 'Failed to cancel')
    }
    setLoading(null)
  }

  // Group classes by day
  const byDay: Record<number, GymClass[]> = {}
  for (const c of classes) {
    if (!byDay[c.day_of_week]) byDay[c.day_of_week] = []
    byDay[c.day_of_week].push(c)
  }
  // Sort each day by start_time
  for (const day in byDay) {
    byDay[day].sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  const orderedDays = [1, 2, 3, 4, 5, 6, 0] // Mon–Sun

  return (
    <div className="space-y-10">
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* My Bookings */}
      <section>
        <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">My Upcoming Classes</p>
        {myBookingClasses.length === 0 ? (
          <div className="bg-white border border-[#E8E3D9] rounded-2xl p-6 text-center text-[#6B6560] text-sm">
            No classes booked yet. Browse the schedule below.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myBookingClasses.map((c) => (
              <div key={c.id} className="bg-white border border-[#C85C2D]/30 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-[#1C1A17]">{c.name}</p>
                    <p className="text-xs text-[#6B6560] mt-0.5">{c.coach_name}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-[#C85C2D]/10 text-[#C85C2D] rounded-full font-medium">
                    {DAY_SHORT[c.day_of_week]}
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
                  className="w-full py-2 text-xs font-medium text-[#6B6560] border border-[#E8E3D9] rounded-full hover:border-red-300 hover:text-red-500 transition disabled:opacity-50"
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
          {orderedDays.map((dayIdx) => {
            const dayCls = byDay[dayIdx]
            if (!dayCls || dayCls.length === 0) return null
            const isToday = dayIdx === todayIdx
            return (
              <div key={dayIdx}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className={`font-serif text-lg ${isToday ? 'text-[#C85C2D]' : 'text-[#1C1A17]'}`}>
                    {DAYS[dayIdx]}
                  </h2>
                  {isToday && (
                    <span className="text-xs px-2 py-0.5 bg-[#C85C2D]/10 text-[#C85C2D] rounded-full font-medium">
                      Today
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dayCls.map((c) => {
                    const isBooked = bookedIds.has(c.id)
                    const spots = spotsByClassId[c.id] ?? c.max_spots
                    const spotsLeft = c.max_spots - spots
                    const full = spotsLeft <= 0
                    return (
                      <div
                        key={c.id}
                        className={`bg-white border rounded-2xl p-5 flex flex-col gap-4 ${
                          isBooked ? 'border-[#1F3D2B]/30' : 'border-[#E8E3D9]'
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
                            <p className={`font-medium ${spotsLeft <= 3 ? 'text-[#C85C2D]' : 'text-[#1C1A17]'}`}>
                              {full ? 'Full' : `${spotsLeft} / ${c.max_spots}`}
                            </p>
                          </div>
                        </div>

                        {isBooked ? (
                          <button
                            onClick={() => handleCancel(c.id)}
                            disabled={loading === c.id}
                            className="mt-auto py-2.5 text-xs font-medium text-[#6B6560] border border-[#E8E3D9] rounded-full hover:border-red-300 hover:text-red-500 transition disabled:opacity-50"
                          >
                            {loading === c.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBook(c.id)}
                            disabled={loading === c.id || full}
                            className="mt-auto py-2.5 text-xs font-medium bg-[#C85C2D] text-white rounded-full hover:bg-[#b34f26] transition disabled:opacity-50 disabled:cursor-not-allowed"
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
