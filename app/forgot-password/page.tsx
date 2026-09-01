'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#D6D3CC] px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <a href="/" className="inline-flex items-baseline gap-1.5 justify-center mb-2">
            <span className="font-serif italic text-2xl text-[#1C1A17]">Pinnacle</span>
            <span className="text-xs tracking-[0.15em] uppercase font-medium text-[#6B6560]">GYM</span>
          </a>
          <p className="text-[#6B6560] text-sm mt-2">Reset your password</p>
        </div>

        <div className="bg-white border border-[#C4C1BA] rounded-2xl p-8 shadow-sm">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#1F3D2B]/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[#1F3D2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-serif text-xl text-[#1C1A17] mb-2">Check your email</h2>
              <p className="text-[#6B6560] text-sm">
                We sent a reset link to <strong>{email}</strong>. Click the link to set a new password.
              </p>
              <a href="/auth" className="inline-block mt-6 text-xs text-[#6B6560] hover:text-[#1C1A17] transition">
                ← Back to sign in
              </a>
            </div>
          ) : (
            <>
              <h2 className="font-serif text-xl text-[#1C1A17] mb-1">Forgot your password?</h2>
              <p className="text-[#6B6560] text-sm mb-6">Enter your email and we&apos;ll send you a reset link.</p>

              {error && (
                <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#6B6560] mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 bg-white border border-[#C4C1BA] rounded-xl text-[#1C1A17] placeholder-[#6B6560]/50 focus:outline-none focus:border-[#54504A] focus:ring-1 focus:ring-[#54504A] transition text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#54504A] hover:bg-[#3d3a35] disabled:opacity-60 text-white font-medium rounded-full transition-colors text-sm"
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-5 text-center">
                <a href="/auth" className="text-xs text-[#6B6560] hover:text-[#1C1A17] transition">
                  ← Back to sign in
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
