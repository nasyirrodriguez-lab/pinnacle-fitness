'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { AiFillCheckCircle } from 'react-icons/ai'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { requestLinkSchema, type RequestLinkInput } from '@/lib/schemas/auth'

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'success' }

interface SignInFormProps {
  next?: string
  mode?: 'sign-in' | 'sign-up'
}

export default function SignInForm({
  next,
  mode = 'sign-in',
}: SignInFormProps) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [submittedEmail, setSubmittedEmail] = useState('')

  const form = useForm<RequestLinkInput>({
    resolver: zodResolver(requestLinkSchema),
    defaultValues: { email: '', next },
  })

  const onSubmit = async (data: RequestLinkInput) => {
    setState({ kind: 'submitting' })
    try {
      const res = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, next }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? 'Failed to send link')
      }
      setSubmittedEmail(data.email)
      setState({ kind: 'success' })
    } catch (err) {
      console.error(err)
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong',
      })
    }
  }

  if (state.kind === 'success') {
    return (
      <SuccessState
        email={submittedEmail}
        next={next}
        onReset={() => {
          setState({ kind: 'idle' })
          form.reset()
        }}
      />
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@theworx.io"
                  disabled={state.kind === 'submitting'}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {state.kind === 'error' && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={state.kind === 'submitting'}
        >
          {state.kind === 'submitting'
            ? 'Sending link…'
            : mode === 'sign-up'
              ? 'Send sign-up link'
              : 'Send sign-in link'}
        </Button>

        <p className="text-xs text-neutral-500 text-center">
          {mode === 'sign-up'
            ? "We'll email you a link to set up your account. No password needed. You'll review and accept our Terms in the next step."
            : "We'll email you a secure link to sign in. No password needed."}
        </p>
      </form>
    </Form>
  )
}

interface SuccessProps {
  email: string
  next?: string
  onReset: () => void
}

function SuccessState({ email, next, onReset }: SuccessProps) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resendNotice, setResendNotice] = useState<string | null>(null)

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{6,8}$/.test(code)) {
      setError('Enter the code from your email.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, next }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        next?: string
      }
      if (!res.ok) {
        setError(body.error ?? 'Could not verify code')
        setBusy(false)
        return
      }
      window.location.assign(body.next ?? '/dashboard')
    } catch {
      setError('Network error. Try again.')
      setBusy(false)
    }
  }

  const resend = async () => {
    setResending(true)
    setError(null)
    setResendNotice(null)
    setCode('')
    try {
      const res = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, next }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'Could not resend. Try again in a moment.')
        return
      }
      setResendNotice(`We sent a fresh link and code to ${email}.`)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <AiFillCheckCircle className="block w-12 h-12 text-turquoise-500" />
      <h2 className="font-heading text-2xl">Enter your code</h2>
      <p className="text-neutral-600 max-w-sm">
        We sent an 8-digit code to{' '}
        <span className="font-medium text-neutral-900">{email}</span>. Paste it
        below to sign in.
      </p>

      <form onSubmit={submitCode} className="w-full space-y-3 mt-2">
        <Input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          placeholder="12345678"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, '').slice(0, 8))
          }
          className="text-center tracking-[0.4em] font-mono text-2xl h-14"
          disabled={busy}
          aria-label="One-time sign-in code"
        />
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {resendNotice && (
          <Alert>
            <AlertDescription>{resendNotice}</AlertDescription>
          </Alert>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={busy || code.length < 6}
        >
          {busy ? 'Verifying…' : 'Sign in'}
        </Button>
      </form>

      <div className="w-full border-t border-neutral-200 pt-4 mt-2 space-y-2">
        <p className="text-xs text-neutral-500">
          Didn&apos;t get the code? Check spam, or{' '}
          <button
            type="button"
            onClick={resend}
            disabled={resending || busy}
            className="text-turquoise-700 hover:text-turquoise-900 underline disabled:opacity-50"
          >
            {resending ? 'sending…' : 'send a new one'}
          </button>
          .
        </p>
        <p className="text-xs text-neutral-500">
          The email also contains a tap-to-sign-in link, but only works in this
          same browser.
        </p>
      </div>

      <button
        type="button"
        className="text-xs text-neutral-500 underline mt-1"
        onClick={onReset}
      >
        Use a different email
      </button>
    </div>
  )
}
