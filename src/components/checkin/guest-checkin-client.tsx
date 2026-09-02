'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Compass,
  AlertCircle,
  PartyPopper,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SelfieCapture from '@/components/selfie-capture/selfie-capture'
import SlideWizard from '@/components/slide-wizard/slide-wizard'

type Kind = 'intro' | 'with-member' | 'guest-of-coach' | 'tour'

interface FormState {
  kind: Kind | null
  fullName: string
}

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; name: string }
  | { kind: 'error'; message: string }

const KIND_OPTIONS: Array<{
  value: Kind
  label: string
  description: string
  icon: typeof CalendarClock
}> = [
  {
    value: 'intro',
    label: 'My intro session',
    description: 'Applied and booked an intro with a coach.',
    icon: ClipboardList,
  },
  {
    value: 'with-member',
    label: "I'm here with a member",
    description: 'A member is bringing you in on their guest visit.',
    icon: UserRound,
  },
  {
    value: 'guest-of-coach',
    label: 'Guest of Nasyir or Matthew',
    description: 'The coaches know you’re coming.',
    icon: PartyPopper,
  },
  {
    value: 'tour',
    label: 'Just having a look',
    description: 'First time here — show me around.',
    icon: Compass,
  },
]

interface GuestCheckinClientProps {
  // The same wizard powers both the iPad kiosk (gated, paired device) and
  // the visitor's phone (public). Caller decides which endpoint receives
  // the FormData.
  endpoint?: string
}

export default function GuestCheckinClient({
  endpoint = '/api/checkin/guest',
}: GuestCheckinClientProps = {}) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [form, setForm] = useState<FormState>({
    kind: null,
    fullName: '',
  })
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  // Auto-reset to a fresh kiosk screen 10s after success
  useEffect(() => {
    if (status.kind !== 'success') return
    const t = window.setTimeout(() => {
      setForm({ kind: null, fullName: '' })
      setDirection('forward')
      setStep(0)
      setStatus({ kind: 'idle' })
    }, 10000)
    return () => window.clearTimeout(t)
  }, [status])

  const submit = async (selfieBlob: Blob) => {
    if (!form.kind || !form.fullName.trim()) return
    setStatus({ kind: 'submitting' })

    const fd = new FormData()
    fd.append('fullName', form.fullName.trim())
    // Every guest is logged as a guest visit with the reason the coaches
    // care about; tours stay their own kind so the feed can tell them apart.
    fd.append('kind', form.kind === 'tour' ? 'tour' : 'guest')
    if (form.kind === 'intro') fd.append('reason', 'intro session')
    if (form.kind === 'with-member') fd.append('reason', 'guest of a member')
    if (form.kind === 'guest-of-coach') fd.append('reason', 'guest of a coach')
    // Reaching the selfie step requires tapping "I agree" on the terms
    // step, so acceptance is guaranteed by the wizard flow.
    fd.append('termsAccepted', 'true')
    fd.append('selfie', selfieBlob, 'selfie.jpg')

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: fd,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setStatus({
          kind: 'error',
          message: humanError(data.error),
        })
        return
      }
      setStatus({ kind: 'success', name: form.fullName.trim() })
    } catch {
      setStatus({ kind: 'error', message: 'Network error. Try again.' })
    }
  }

  if (status.kind === 'success') {
    return (
      <Card>
        <CheckCircle2 size={56} className="text-turquoise-500 mb-3" />
        <h2 className="font-heading text-3xl mb-1">
          Welcome, {status.name.split(' ')[0]}.
        </h2>
        <p className="text-neutral-600">
          The manager has been notified. Have a great visit.
        </p>
      </Card>
    )
  }

  if (status.kind === 'error') {
    return (
      <Card>
        <AlertCircle size={48} className="text-red-500 mb-3" />
        <h2 className="font-heading text-xl mb-2">Couldn&apos;t check in</h2>
        <p className="text-sm text-neutral-600 mb-4">{status.message}</p>
        <Button onClick={() => setStatus({ kind: 'idle' })}>Try again</Button>
      </Card>
    )
  }

  const goNext = () => {
    setDirection('forward')
    setStep((s) => Math.min(s + 1, 3))
  }
  const goBack = () => {
    setDirection('back')
    setStep((s) => Math.max(s - 1, 0))
  }

  return (
    <div>
      {step > 0 && (
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      )}

      <SlideWizard step={step} direction={direction}>
        <KindStep
          onSelect={(kind) => {
            setForm((f) => ({ ...f, kind }))
            goNext()
          }}
        />
        <NameStep
          value={form.fullName}
          onChange={(fullName) => setForm((f) => ({ ...f, fullName }))}
          onContinue={goNext}
        />
        <TermsStep onAgree={goNext} />
        <SelfieStep busy={status.kind === 'submitting'} onCapture={submit} />
      </SlideWizard>
    </div>
  )
}

function KindStep({ onSelect }: { onSelect: (k: Kind) => void }) {
  return (
    <div>
      <h2 className="font-heading text-3xl md:text-4xl mb-2">
        I&apos;m here for…
      </h2>
      <p className="text-neutral-600 mb-6">Tap whichever fits.</p>
      <div className="grid grid-cols-1 gap-3">
        {KIND_OPTIONS.map((opt) => {
          const Icon = opt.icon
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              className="flex items-center gap-4 text-left bg-white border border-neutral-200 rounded-lg p-5 hover:border-turquoise-500 hover:shadow-sm transition group"
            >
              <span className="w-12 h-12 rounded-md bg-turquoise-50 text-turquoise-700 flex items-center justify-center shrink-0">
                <Icon size={22} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-lg">{opt.label}</span>
                <span className="block text-sm text-neutral-600">
                  {opt.description}
                </span>
              </span>
              <ArrowRight
                size={18}
                className="text-neutral-400 group-hover:text-turquoise-600 transition"
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function NameStep({
  value,
  onChange,
  onContinue,
}: {
  value: string
  onChange: (v: string) => void
  onContinue: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    // Autofocus + scroll to top so the on-screen keyboard doesn't cover it.
    ref.current?.focus()
    window.scrollTo({ top: 0 })
  }, [])
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim().length > 0) onContinue()
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="font-heading text-3xl md:text-4xl">
        Enter your full name
      </h2>
      <Input
        ref={ref}
        type="text"
        autoCapitalize="words"
        autoComplete="name"
        maxLength={200}
        placeholder="First and last name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-14 text-xl"
      />
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={value.trim().length === 0}
      >
        Continue
        <ArrowRight size={18} className="ml-2" />
      </Button>
    </form>
  )
}

function TermsStep({ onAgree }: { onAgree: () => void }) {
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <div className="space-y-5">
      <h2 className="font-heading text-3xl md:text-4xl">One last thing</h2>
      <div className="bg-white border border-neutral-200 rounded-lg p-5 space-y-3 text-sm text-neutral-700">
        <p>By checking in you agree to the Pinnacle Member Code:</p>
        <ul className="space-y-1.5 pl-4 list-disc text-neutral-600">
          <li>Follow the house rules and treat the space and people kindly.</li>
          <li>
            Your visit is logged — name, photo, and check-in time — so the team
            knows who&apos;s in the building.
          </li>
          <li>
            You&apos;re responsible for your belongings and any guests you
            bring.
          </li>
        </ul>
        <p className="text-xs text-neutral-500">
          Full terms at{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-turquoise-700"
          >
            pinnaclefitness.app/terms
          </a>
          .
        </p>
      </div>
      <Button type="button" size="lg" className="w-full" onClick={onAgree}>
        I agree — continue
        <ArrowRight size={18} className="ml-2" />
      </Button>
    </div>
  )
}

function SelfieStep({
  busy,
  onCapture,
}: {
  busy: boolean
  onCapture: (blob: Blob) => Promise<void>
}) {
  return (
    <div>
      <h2 className="font-heading text-3xl md:text-4xl mb-2">
        One quick photo
      </h2>
      <p className="text-neutral-600 mb-6">
        So the team can recognize you. Center your face in the circle.
      </p>
      <SelfieCapture
        busy={busy}
        onCapture={onCapture}
        confirmLabel="Check me in"
      />
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

function humanError(code: string | undefined): string {
  switch (code) {
    case 'kiosk_not_paired':
      return 'This tablet is no longer paired. Ask an admin to re-pair.'
    case 'visit_insert_failed':
      return 'We couldn’t save your visit. Try again or ask the manager.'
    default:
      return code || 'Something went wrong. Try again.'
  }
}
