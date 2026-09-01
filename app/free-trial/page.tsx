'use client'

import { useState } from 'react'
import Link from 'next/link'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TIMES = [
  '5:30 AM', '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM',
]

export default function FreeTrialPage() {
  const [fields, setFields] = useState({ name: '', email: '', phone: '', day: '', time: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const res = await fetch('/api/free-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fields.name,
        email: fields.email,
        phone: fields.phone,
        classDay: fields.day,
        classTime: fields.time,
        className: 'Free Trial',
      }),
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
  const selectClass = `${inputClass} cursor-pointer appearance-none`

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
          <p className="text-[#6B6560] mb-8">
            We&apos;ll see you on <strong>{fields.day}</strong> at <strong>{fields.time}</strong>.
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
      <div className="py-16 px-6 sm:px-12 max-w-xl mx-auto">
        <div className="mb-2">
          <span className="inline-block bg-[#C85C2D] text-white text-xs font-semibold tracking-[0.1em] uppercase px-4 py-1.5 rounded-full">Free — No card required</span>
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl text-[#1C1A17] mt-4 mb-3">Book your free class.</h1>
        <p className="text-[#6B6560] text-lg mb-10">
          Pick a day and time, fill in your details, and we&apos;ll see you on the floor. No membership needed.
        </p>

        <div className="bg-white rounded-2xl border border-[#E8E3D9] p-8">
          {status === 'error' && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{errorMsg}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={labelClass}>Full Name</label>
              <input type="text" value={fields.name} onChange={set('name')} required placeholder="Alex Johnson" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={fields.email} onChange={set('email')} required placeholder="you@example.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone Number</label>
              <input type="tel" value={fields.phone} onChange={set('phone')} required placeholder="+1 868 123 4567" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Preferred Day</label>
              <select value={fields.day} onChange={set('day')} required className={selectClass}>
                <option value="">Select a day…</option>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Preferred Time</label>
              <select value={fields.time} onChange={set('time')} required className={selectClass}>
                <option value="">Select a time…</option>
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3 bg-[#C85C2D] hover:bg-[#b34f26] disabled:opacity-50 text-white font-medium rounded-full transition-colors text-sm mt-2"
            >
              {status === 'loading' ? 'Booking…' : 'Book Free Class'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
