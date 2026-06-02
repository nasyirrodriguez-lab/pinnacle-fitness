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
    'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {status === 'success' && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400">
          Message sent! We'll get back to you within 24 hours.
        </div>
      )}
      {status === 'error' && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          Something went wrong. Please try again.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Full Name</label>
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
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
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
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Subject</label>
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
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Message</label>
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
        className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-60 transition-colors"
      >
        {status === 'loading' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  )
}
