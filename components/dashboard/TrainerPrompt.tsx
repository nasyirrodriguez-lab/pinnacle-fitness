'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TrainerPrompt() {
  const [trainer, setTrainer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!trainer) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/profile/trainer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainer }),
    })
    })

    if (!res.ok) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#E8E4DC] flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <a href="/" className="inline-block mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pinnacle-logo-transparent.png" alt="Pinnacle Fitness" style={{ height: 48 }} className="mx-auto" />
        </a>

        <h1 className="font-serif text-2xl text-[#3A3733] mb-2">Choose your trainer</h1>
        <p className="text-[#6B6560] text-sm mb-8">
          Select the trainer who will be coaching your sessions.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {['Nasyir Rodriguez', 'Matthew Sirjoo'].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setTrainer(name)}
                className={`rounded-2xl border-2 p-5 text-center transition-all ${
                  trainer === name
                    ? 'border-[#C85C2D] bg-[#C85C2D]/5'
                    : 'border-[#CCC8C0] bg-white hover:border-[#3A3733]/30'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-[#3A3733] text-[#E8E4DC] flex items-center justify-center text-lg font-semibold mx-auto mb-3">
                  {name[0]}
                </div>
                <p className="text-sm font-medium text-[#3A3733]">{name}</p>
                <p className="text-xs text-[#6B6560] mt-0.5">Co-Founder / Trainer</p>
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!trainer || loading}
            className="w-full py-3.5 rounded-full bg-[#C85C2D] text-white text-sm font-medium hover:bg-[#b34f26] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving…' : 'Continue to dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}
