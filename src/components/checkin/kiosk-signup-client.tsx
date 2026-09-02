'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { ArrowLeft, MailCheck, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Status =
  | { kind: 'form' }
  | { kind: 'success'; email: string }
  | { kind: 'error'; message: string }

// Kiosk membership signup. The iPad only collects the basics; the new
// member finishes on their own phone via the emailed magic link, so no
// passwords or personal browsing happen on the shared tablet.
export default function KioskSignupClient() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'form' })
  const [isPending, startTransition] = useTransition()

  // Fresh screen for the next visitor after a successful signup.
  useEffect(() => {
    if (status.kind !== 'success') return
    const t = window.setTimeout(() => {
      window.location.href = '/checkin'
    }, 15000)
    return () => window.clearTimeout(t)
  }, [status])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkin/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message:
              data.error === 'kiosk_not_paired'
                ? 'This tablet is no longer paired. Ask the team for help.'
                : (data.error ?? 'Could not create your account. Try again.'),
          })
          return
        }
        setStatus({ kind: 'success', email: email.trim() })
      } catch {
        setStatus({ kind: 'error', message: 'Network error. Try again.' })
      }
    })
  }

  if (status.kind === 'success') {
    return (
      <Card>
        <MailCheck size={56} className="text-turquoise-500 mb-3" />
        <h2 className="font-heading text-3xl mb-2">Check your phone!</h2>
        <p className="text-neutral-600 max-w-sm">
          We sent a sign-in link to{' '}
          <span className="font-medium">{status.email}</span>. Open it on your
          phone to accept the terms, snap a selfie, and claim your free Explore
          Pass.
        </p>
        <p className="text-xs text-neutral-500 mt-4">
          This screen resets in a few seconds.
        </p>
      </Card>
    )
  }

  if (status.kind === 'error') {
    return (
      <Card>
        <AlertCircle size={48} className="text-red-500 mb-3" />
        <h2 className="font-heading text-xl mb-2">That didn&apos;t work</h2>
        <p className="text-sm text-neutral-600 mb-4">{status.message}</p>
        <Button onClick={() => setStatus({ kind: 'form' })}>Try again</Button>
      </Card>
    )
  }

  return (
    <div>
      <Link
        href="/checkin"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      <div className="mb-6">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-turquoise-700 font-medium mb-2">
          <Sparkles size={14} />
          Join The Worx
        </p>
        <h1 className="font-heading text-3xl md:text-4xl mb-2">
          Become a member
        </h1>
        <p className="text-neutral-600">
          Three quick details — then finish on your own phone.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4 max-w-md"
      >
        <Input
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={isPending}
          maxLength={120}
          className="h-12"
        />
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          maxLength={200}
          className="h-12"
        />
        <Input
          type="tel"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={isPending}
          maxLength={40}
          className="h-12"
        />
        <Button
          type="submit"
          size="lg"
          className="w-full h-12"
          disabled={
            isPending || !fullName.trim() || !email.trim() || !phone.trim()
          }
        >
          {isPending ? 'Creating your account…' : 'Create my account'}
        </Button>
      </form>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-10 flex flex-col items-center text-center">
      {children}
    </div>
  )
}
