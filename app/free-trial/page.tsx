'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface GymClass {
  id: string
  name: string
  coach_name: string
  day_of_week: string
  start_time: string
  duration_min: number
  location: string
  max_spots: number
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function FreeTrialPage() {
  const [classes, setClasses] = useState<GymClass[]>([])
  const [selectedClass, setSelectedClass] = useState<GymClass | null>(null)
  const [fields, setFields] = useState({ name: '', email: '', phone: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetch('/api/classes/list')
      .then((r) => r.json())
      .then((d) => setClasses(d.classes ?? []))
      .catch(() => {})
  }, [])

  const grouped = DAY_ORDER.reduce<Record<string, GymClass[]>>((acc, day) => {
    const list = classes.filter((c) => c.day_of_week === day)
    if (list.length) acc[day] = list
    return acc
  }, {})

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClass) return
    setStatus('loading')
    setErrorMsg('')

    const res = await fetch('/api/free-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, classId: selectedClass.id, className: selectedClass.name, classDay: selectedClass.day_of_week, classTime: selectedClass.start_time }),
    })

    if (res.ok) {
      setStatus('success')
    } else {
      const data = await res.json()
      setErrorMsg(data.error ?? 'Something went wrong.')
      setStatus('error')
    }
  }

  const inputClass = 'w-full px-4 py-3 bg-white border border-[#E8E3D9] rounded-xl text-[#1C1A17] placeholder-[#6B6560]/50 focus:outline-none focus:border-[#C85C2D] focus:ring-1 focus:ring-[#C85C2D] transition text-sm'
  const labelClass = 'block text-xs font-medium tracking-[0.1em] uppercase text-[#6B6560] mb-1.5'

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-[#1F3D2B]/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#1F3D2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-serif text-3xl text-[#1C1A17] mb-3">You&apos;re booked!</h1>
          <p className="text-[#6B6560] mb-2">
            We&apos;ve sent a confirmation to <strong>{fields.email}</strong>.
          </p>
          <p className="text-[#6B6560] mb-8">
            See you at <strong>{selectedClass?.name}</strong> on <strong>{selectedClass?.day_of_week}</strong> at <strong>{selectedClass ? formatTime(selectedClass.start_time) : ''}</strong>.
          </p>
          <Link href="/" className="inline-block bg-[#C85C2D] text-white rounded-full px-7 py-3 text-sm font-medium hover:bg-[#b34f26] transition-colors">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#F5F0E8] min-h-screen pt-20">
      <div className="py-16 px-6 sm:px-12 max-w-5xl mx-auto">
        <div className="mb-2">
          <span className="inline-block bg-[#C85C2D] text-white text-xs font-semibold tracking-[0.1em] uppercase px-4 py-1.5 rounded-full">Free — No card required</span>
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl text-[#1C1A17] mt-4 mb-3">Book your free class.</h1>
        <p className="text-[#6B6560] text-lg max-w-xl mb-12">
          Pick a class, fill in your details, and we&apos;ll see you on the floor. No membership needed.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Class picker */}
          <div className="lg:col-span-3 space-y-6">
            <h2 className="font-serif text-2xl text-[#1C1A17]">Choose a class</h2>
            {Object.keys(grouped).length === 0 && (
              <p className="text-[#6B6560] text-sm">Loading schedule…</p>
            )}
            {Object.entries(grouped).map(([day, list]) => (
              <div key={day}>
                <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-3">{day}</p>
                <div className="space-y-2">
                  {list.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClass(cls)}
                      className={`w-full text-left rounded-xl border p-4 transition-all ${
                        selectedClass?.id === cls.id
                          ? 'border-[#C85C2D] bg-[#C85C2D]/5 ring-1 ring-[#C85C2D]'
                          : 'border-[#E8E3D9] bg-white hover:border-[#C85C2D]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#1C1A17]">{cls.name}</p>
                          <p className="text-xs text-[#6B6560] mt-0.5">{cls.coach_name} · {cls.duration_min} min · {cls.location}</p>
                        </div>
                        <span className="text-sm font-medium text-[#C85C2D] ml-4 flex-shrink-0">{formatTime(cls.start_time)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-[#E8E3D9] p-6 sticky top-24">
              <h2 className="font-serif text-xl text-[#1C1A17] mb-1">Your details</h2>
              {selectedClass ? (
                <p className="text-xs text-[#6B6560] mb-5">
                  Booking: <span className="text-[#C85C2D] font-medium">{selectedClass.name}</span> — {selectedClass.day_of_week} at {formatTime(selectedClass.start_time)}
                </p>
              ) : (
                <p className="text-xs text-[#6B6560] mb-5">Select a class to continue</p>
              )}

              {status === 'error' && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{errorMsg}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>Full Name</label>
                  <input type="text" value={fields.name} onChange={set('name')} required placeholder="Alex Johnson" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" value={fields.email} onChange={set('email')} required placeholder="you@example.com" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input type="tel" value={fields.phone} onChange={set('phone')} required placeholder="+1 868 123 4567" className={inputClass} />
                </div>
                <button
                  type="submit"
                  disabled={status === 'loading' || !selectedClass}
                  className="w-full py-3 bg-[#C85C2D] hover:bg-[#b34f26] disabled:opacity-50 text-white font-medium rounded-full transition-colors text-sm mt-2"
                >
                  {status === 'loading' ? 'Booking…' : 'Book Free Class'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
