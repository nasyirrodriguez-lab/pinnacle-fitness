'use client'

import { useState, useTransition } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import SelfieCapture from '@/components/selfie-capture/selfie-capture'
import TermsContent from '@/components/terms/terms-content'
import { completeOnboarding, type Goal } from '@/app/welcome/actions'

// Nike-style onboarding: one question per full-screen step, a counter
// top-right, Skip on the left where a step is optional, a turf arrow
// pill to move on. Six steps, then straight into the app.

interface Props {
  defaultFullName: string
  defaultPhone: string
  next?: string
}

const GOALS: { id: Goal; title: string; body: string }[] = [
  { id: 'strength', title: 'Strength', body: 'Lift more, build muscle.' },
  { id: 'lean', title: 'Lean & fit', body: 'Drop fat, feel sharp.' },
  {
    id: 'performance',
    title: 'Performance',
    body: 'Faster, more explosive, sport-ready.',
  },
  {
    id: 'health',
    title: 'General health',
    body: 'Move well, stay consistent.',
  },
]

const STEPS = ['you', 'goal', 'notes', 'coach', 'pin', 'code'] as const
type Step = (typeof STEPS)[number]

export default function OnboardingForm({
  defaultFullName,
  defaultPhone,
  next,
}: Props) {
  const [step, setStep] = useState<Step>('you')
  const [fullName, setFullName] = useState(defaultFullName)
  const [phone, setPhone] = useState(defaultPhone)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [notes, setNotes] = useState('')
  const [coach, setCoach] = useState<'nasyir' | 'matthew' | 'none' | null>(
    null
  )
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [selfieBusy, setSelfieBusy] = useState(false)
  const [selfieDone, setSelfieDone] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const index = STEPS.indexOf(step)
  const go = (delta: number) => {
    setError(null)
    const nextIndex = Math.min(STEPS.length - 1, Math.max(0, index + delta))
    setStep(STEPS[nextIndex])
  }

  const uploadSelfie = async (blob: Blob) => {
    setSelfieBusy(true)
    try {
      const fd = new FormData()
      fd.append('selfie', blob, 'selfie.jpg')
      const res = await fetch('/api/profile/selfie', {
        method: 'POST',
        body: fd,
      })
      if (res.ok) {
        setSelfieDone(true)
        setShowCamera(false)
      } else {
        setError('Could not save your photo — you can add it later in Settings.')
      }
    } finally {
      setSelfieBusy(false)
    }
  }

  const validateStep = (): string | null => {
    if (step === 'you') {
      if (!fullName.trim()) return 'Your name is required'
      if (!/^\+?[\d\s\-()]{7,}$/.test(phone.trim()))
        return 'Enter a valid phone number'
    }
    if (step === 'goal' && !goal) return 'Pick the one closest to you'
    if (step === 'coach' && !coach) return 'Pick a coach, or no preference'
    if (step === 'pin') {
      if (!/^\d{4}$/.test(pin)) return 'Your PIN is four digits'
      if (pin !== pinConfirm) return 'The two PINs don’t match'
    }
    if (step === 'code' && !accepted) return 'Accept the Member Code to finish'
    return null
  }

  const advance = () => {
    const problem = validateStep()
    if (problem) {
      setError(problem)
      return
    }
    if (step !== 'code') {
      go(1)
      return
    }
    startTransition(async () => {
      const result = await completeOnboarding({
        fullName: fullName.trim(),
        phone: phone.trim(),
        goal: goal ?? 'health',
        trainingNotes: notes,
        preferredCoach: coach ?? 'none',
        pin,
        acceptTerms: true,
        next,
      })
      if (result && !result.ok) setError(result.error)
    })
  }

  const firstName = fullName.trim().split(/\s+/)[0]

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between text-xs tracking-[0.18em] uppercase text-ice-mute mb-10">
        <span>Set up</span>
        <span className="font-stat text-base tracking-normal text-ice">
          {index + 1}/{STEPS.length}
        </span>
      </div>

      <div className="flex-1">
        {step === 'you' && (
          <StepShell
            title={
              <>
                You&apos;re in.
                <br />
                Let&apos;s set you up.
              </>
            }
            body="Your name as the coaches will know it, and a number we can reach you on."
          >
            <div className="space-y-3 max-w-md">
              <Input
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                className="h-12 rounded-full px-5"
              />
              <Input
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                className="h-12 rounded-full px-5"
              />
              {showCamera ? (
                <div className="rounded-lg overflow-hidden">
                  <SelfieCapture
                    onCapture={uploadSelfie}
                    busy={selfieBusy}
                    confirmLabel="Use this photo"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="w-full h-12 rounded-full border border-border text-sm text-ice-dim hover:text-ice hover:border-ice transition"
                >
                  {selfieDone ? '✓ Photo saved · retake' : 'Add a photo (optional)'}
                </button>
              )}
            </div>
          </StepShell>
        )}

        {step === 'goal' && (
          <StepShell
            title={
              <>
                Choose
                <br />
                your goal
              </>
            }
            body="Tell your coach what you’re training for."
          >
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {GOALS.map((g) => {
                const on = goal === g.id
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={
                      on
                        ? 'text-left rounded-lg p-4 bg-bronze-raised border border-ice'
                        : 'text-left rounded-lg p-4 border border-border hover:border-ice-dim'
                    }
                  >
                    <span
                      className={
                        on
                          ? 'inline-flex w-5 h-5 rounded-full bg-primary text-primary-foreground items-center justify-center mb-3'
                          : 'inline-flex w-5 h-5 rounded-full border border-ice-mute mb-3'
                      }
                    >
                      {on && <Check size={12} />}
                    </span>
                    <span className="block font-heading text-base">{g.title}</span>
                    <span className="block text-xs text-ice-dim mt-1">
                      {g.body}
                    </span>
                  </button>
                )
              })}
            </div>
          </StepShell>
        )}

        {step === 'notes' && (
          <StepShell
            title={
              <>
                Anything your
                <br />
                coach should know?
              </>
            }
            body="Injuries, limits, what you’ve been doing lately. Optional — but it makes your first session better."
            skip={() => go(1)}
          >
            <Textarea
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. old left-shoulder injury, training 3×/week, mostly machines"
              maxLength={1000}
              className="max-w-md rounded-lg"
            />
          </StepShell>
        )}

        {step === 'coach' && (
          <StepShell
            title={
              <>
                Who do you
                <br />
                want to train with?
              </>
            }
            body="You can book either coach any time — this just tells us who to put you with first."
          >
            <div className="flex flex-col gap-3 max-w-md">
              {[
                { id: 'nasyir' as const, name: 'Nasyir', body: 'Strength & conditioning' },
                { id: 'matthew' as const, name: 'Matthew', body: 'Programming & structure' },
                { id: 'none' as const, name: 'No preference', body: 'Put me where there’s space' },
              ].map((c) => {
                const on = coach === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCoach(c.id)}
                    className={
                      on
                        ? 'flex items-center justify-between rounded-full px-5 h-14 bg-ice text-ground'
                        : 'flex items-center justify-between rounded-full px-5 h-14 border border-border hover:border-ice-dim'
                    }
                  >
                    <span className="font-heading">{c.name}</span>
                    <span className={on ? 'text-xs opacity-70' : 'text-xs text-ice-mute'}>
                      {c.body}
                    </span>
                  </button>
                )
              })}
            </div>
          </StepShell>
        )}

        {step === 'pin' && (
          <StepShell
            title={
              <>
                Set your
                <br />
                check-in PIN
              </>
            }
            body="Four digits. If your phone dies, find your name on the iPad and type this to get in."
          >
            <div className="space-y-3 max-w-xs">
              <Input
                placeholder="PIN"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                inputMode="numeric"
                type="password"
                autoComplete="off"
                className="h-14 rounded-full px-5 text-center font-stat text-2xl tracking-[0.4em]"
              />
              <Input
                placeholder="Again"
                value={pinConfirm}
                onChange={(e) =>
                  setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                inputMode="numeric"
                type="password"
                autoComplete="off"
                className="h-14 rounded-full px-5 text-center font-stat text-2xl tracking-[0.4em]"
              />
            </div>
          </StepShell>
        )}

        {step === 'code' && (
          <StepShell
            title={
              <>
                The Member
                <br />
                Code
              </>
            }
            body="Short, and it’s how we keep the floor good for everyone."
          >
            <div className="max-w-xl">
              <TermsContent scrollable />
              <label className="mt-4 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-[#4EC95C]"
                />
                <span className="text-sm text-ice-dim">
                  I&apos;ve read the Member Code and I&apos;m in.
                </span>
              </label>
            </div>
          </StepShell>
        )}
      </div>

      {error && <p className="text-sm text-bad mt-4">{error}</p>}

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0 || isPending}
          className="text-sm text-ice-dim disabled:opacity-0"
        >
          Back
        </button>
        <button
          type="button"
          onClick={advance}
          disabled={isPending}
          aria-label={step === 'code' ? 'Finish' : 'Next'}
          className="inline-flex items-center gap-2 h-14 px-7 rounded-full bg-primary text-primary-foreground font-heading text-sm disabled:opacity-60"
        >
          {step === 'code'
            ? isPending
              ? 'Saving…'
              : `Let’s go${firstName ? `, ${firstName}` : ''}`
            : ''}
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  )
}

function StepShell({
  title,
  body,
  skip,
  children,
}: {
  title: React.ReactNode
  body: string
  skip?: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <h1 className="heading-display text-4xl sm:text-5xl mb-3">{title}</h1>
      <p className="text-sm text-ice-dim mb-8 max-w-md">{body}</p>
      {children}
      {skip && (
        <button
          type="button"
          onClick={skip}
          className="mt-4 text-sm text-ice-mute underline"
        >
          Skip
        </button>
      )}
    </div>
  )
}
