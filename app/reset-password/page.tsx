'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    toast.success('Password updated successfully!')
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8] px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <a href="/" className="inline-flex items-baseline gap-1.5 justify-center mb-2">
            <span className="font-serif italic text-2xl text-[#1C1A17]">Pinnacle</span>
            <span className="text-xs tracking-[0.15em] uppercase font-medium text-[#6B6560]">GYM</span>
          </a>
          <p className="text-[#6B6560] text-sm mt-2">Set a new password</p>
        </div>

        <div className="bg-white border border-[#E8E3D9] rounded-2xl p-8 shadow-sm">
          <h2 className="font-serif text-xl text-[#1C1A17] mb-1">Create new password</h2>
          <p className="text-[#6B6560] text-sm mb-6">Choose a strong password for your account.</p>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#6B6560] mb-1.5">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white border border-[#E8E3D9] rounded-xl text-[#1C1A17] placeholder-[#6B6560]/50 focus:outline-none focus:border-[#C85C2D] focus:ring-1 focus:ring-[#C85C2D] transition text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#6B6560] mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white border border-[#E8E3D9] rounded-xl text-[#1C1A17] placeholder-[#6B6560]/50 focus:outline-none focus:border-[#C85C2D] focus:ring-1 focus:ring-[#C85C2D] transition text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#C85C2D] hover:bg-[#b34f26] disabled:opacity-60 text-white font-medium rounded-full transition-colors text-sm"
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
