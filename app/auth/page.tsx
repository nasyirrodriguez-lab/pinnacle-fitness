'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [plan, setPlan] = useState<'basic' | 'premium' | 'elite'>('basic')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const memberId = `PF-${Date.now().toString(36).toUpperCase()}`
      const { error: insertError } = await supabase.from('members').insert({
        user_id: data.user.id,
        name,
        email,
        plan_type: plan,
        join_date: new Date().toISOString().split('T')[0],
        member_id: memberId,
        role: 'member',
      })

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }

      setMessage('Account created! Check your email to confirm, then log in.')
      setMode('login')
    }
    setLoading(false)
  }

  const plans = [
    { id: 'basic', label: '8 Sessions', price: '$700/mo', perks: 'Eight coached sessions per month' },
    { id: 'premium', label: '12 Sessions', price: '$900/mo', perks: 'Three sessions a week, coached & progressive' },
    { id: 'elite', label: 'Unlimited', price: '$1000/mo', perks: 'Unlimited coached sessions + open gym access' },
  ] as const

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8] px-4 py-16">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex items-baseline gap-1.5 justify-center mb-2">
            <span className="font-serif italic text-2xl text-[#1C1A17]">Pinnacle</span>
            <span className="text-xs tracking-[0.15em] uppercase font-medium text-[#6B6560]">GYM</span>
          </div>
          <p className="text-[#6B6560] text-sm">Your membership portal</p>
        </div>

        <div className="bg-white border border-[#E8E3D9] rounded-2xl p-8 shadow-sm">
          {/* Tab switcher */}
          <div className="flex bg-[#F5F0E8] rounded-full p-1 mb-8">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setMessage('') }}
                className={`flex-1 py-2 rounded-full text-sm font-medium transition-all ${
                  mode === m
                    ? 'bg-[#C85C2D] text-white shadow-sm'
                    : 'text-[#6B6560] hover:text-[#1C1A17]'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Join Now'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-5">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#6B6560] mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Alex Johnson"
                  className="w-full px-4 py-3 bg-white border border-[#E8E3D9] rounded-xl text-[#1C1A17] placeholder-[#6B6560]/50 focus:outline-none focus:border-[#C85C2D] focus:ring-1 focus:ring-[#C85C2D] transition text-sm"
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
                className="w-full px-4 py-3 bg-white border border-[#E8E3D9] rounded-xl text-[#1C1A17] placeholder-[#6B6560]/50 focus:outline-none focus:border-[#C85C2D] focus:ring-1 focus:ring-[#C85C2D] transition text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#6B6560] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
                className="w-full px-4 py-3 bg-white border border-[#E8E3D9] rounded-xl text-[#1C1A17] placeholder-[#6B6560]/50 focus:outline-none focus:border-[#C85C2D] focus:ring-1 focus:ring-[#C85C2D] transition text-sm"
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#6B6560] mb-2">Membership Plan</label>
                <div className="space-y-2">
                  {plans.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        plan === p.id
                          ? 'border-[#C85C2D] bg-[#C85C2D]/5'
                          : 'border-[#E8E3D9] bg-white hover:border-[#C85C2D]/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={p.id}
                        checked={plan === p.id}
                        onChange={() => setPlan(p.id)}
                        className="accent-[#C85C2D]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-[#1C1A17]">{p.label}</span>
                          <span className="text-[#C85C2D] text-sm font-semibold">{p.price}</span>
                        </div>
                        <p className="text-xs text-[#6B6560] mt-0.5">{p.perks}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#C85C2D] hover:bg-[#b34f26] disabled:opacity-60 text-white font-medium rounded-full transition-colors text-sm"
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
