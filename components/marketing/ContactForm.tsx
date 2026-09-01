'use client'

import { useState } from 'react'

export default function ContactForm() {
  const [fields, setFields] = useState({ name: '', email: '', subject: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })

    if (res.ok) {
      setStatus('success')
      setFields({ name: '', email: '', subject: '', message: '' })
    } else {
      setStatus('error')
    }
  }

  const inputClass =
    'w-full px-4 py-3 bg-white border border-[#CCC8C0] rounded-xl text-[#3A3733] placeholder-[#6B6560]/50 focus:outline-none focus:border-[#3A3733] focus:ring-1 focus:ring-[#3A3733] transition text-sm'

  const labelClass = 'block text-xs font-medium tracking-[0.1em] uppercase text-[#6B6560] mb-1.5'

  if (status === 'success') {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-full bg-[#1F3D2B]/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[#1F3D2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-serif text-xl text-[#3A3733] mb-2">Message sent!</h3>
        <p className="text-[#6B6560] text-sm">We&apos;ll get back to you within 24 hours.</p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-6 text-xs text-[#6B6560] hover:text-[#3A3733] transition"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {status === 'error' && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Something went wrong. Please try again.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={labelClass}>Full Name</label>
          <input
            type="text"
            value={fields.name}
            onChange={set('name')}
            required
            placeholder="Alex Johnson"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={fields.email}
            onChange={set('email')}
            required
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Subject</label>
        <select value={fields.subject} onChange={set('subject')} className={inputClass}>
          <option value="">Select a topic</option>
          <option>Membership inquiry</option>
          <option>Personal training</option>
          <option>Group classes</option>
          <option>Billing question</option>
          <option>Other</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Message</label>
        <textarea
          value={fields.message}
          onChange={set('message')}
          required
          rows={5}
          placeholder="Tell us how we can help…"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full py-3 bg-[#C85C2D] hover:bg-[#b34f26] disabled:opacity-60 text-white font-medium rounded-full transition-colors text-sm"
      >
        {status === 'loading' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  )
}
