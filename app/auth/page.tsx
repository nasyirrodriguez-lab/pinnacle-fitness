'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }
      const userId = data.user?.id
      if (userId) {
        const memberCode = 'PF-' + Math.random().toString(36).substring(2, 10).toUpperCase()
        await fetch('/api/profile/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, fullName, memberCode }),
        })
      }
      toast.success('Account created! Check your email to confirm.')
      router.push('/dashboard')
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }
      router.push('/dashboard')
    }
    setLoading(false)
  }

  const inputClass =
    'w-full px-4 py-3 bg-white border border-[#E8E3D9] rounded-xl text-[#1C1A17] placeholder-[#6B6560]/50 focus:outline-none focus:border-[#C85C2D] focus:ring-1 focus:ring-[#C85C2D] transition text-sm'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8] px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <a href="/" className="inline-flex justify-center mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pinnacle-logo.svg" alt="Pinnacle Fitness" style={{ height: 50 }} />
          </a>
          <p className="text-[#6B6560] text-sm mt-2">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </p>
        </div>

        <div className="bg-white border border-[#E8E3D9] rounded-2xl p-8 shadow-sm">
          {/* Tab toggle */}
          <div className="flex rounded-xl bg-[#F5F0E8] p-1 mb-8">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === m ? 'bg-white text-[#1C1A17] shadow-sm' : 'text-[#6B6560] hover:text-[#1C1A17]'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#6B6560] mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Your full name"
                  className={inputClass}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#6B6560] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#6B6560] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="········"
                className={inputClass}
              />
              {mode === 'signin' && (
                <div className="mt-1.5 text-right">
                  <Link href="/forgot-password" className="text-xs text-[#6B6560] hover:text-[#C85C2D] transition">
                    Forgot password?
                  </Link>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#C85C2D] hover:bg-[#b34f26] disabled:opacity-60 text-white font-medium rounded-full transition-colors text-sm"
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
