'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  applySchema,
  EXPERIENCE_BRACKETS,
  type ApplyFormData,
} from '@/lib/schemas/apply'
import { Display, Pill } from '@/components/marketing/primitives'

export interface PlanOption {
  id: string
  name: string
}

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'sent' }
  | { kind: 'screened' }
  | { kind: 'error'; message: string }

export default function ApplyForm({
  plans,
  defaultPlan,
}: {
  plans: PlanOption[]
  defaultPlan?: string
}) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const form = useForm<ApplyFormData>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      experienceBracket: undefined,
      trainingNow: '',
      goal: '',
      heardFrom: '',
      referredBy: '',
      planInterest: defaultPlan ?? '',
      codeAccepted: undefined,
      company: '',
    },
  })

  const onSubmit = async (data: ApplyFormData) => {
    setState({ kind: 'submitting' })
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        screenedOut?: boolean
        error?: string
      }
      if (!res.ok || !body.ok) {
        setState({
          kind: 'error',
          message: body.error ?? 'Could not send your application. Try again.',
        })
        return
      }
      setState({ kind: body.screenedOut ? 'screened' : 'sent' })
    } catch {
      setState({ kind: 'error', message: 'Network error. Try again.' })
    }
  }

  if (state.kind === 'sent') {
    return (
      <div className="bg-card border border-border rounded-[22px] p-8 md:p-10">
        <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-primary mb-4">
          Application received
        </p>
        <Display as="h2">Got it. A coach reads it next.</Display>
        <ol className="mt-8 space-y-4 text-muted-foreground">
          <li className="flex gap-4">
            <span className="font-stat text-2xl text-primary leading-none">1</span>
            Nasyir or Matthew reads your application.
          </li>
          <li className="flex gap-4">
            <span className="font-stat text-2xl text-primary leading-none">2</span>
            You get invited to an intro session — come train and meet the
            coaches.
          </li>
          <li className="flex gap-4">
            <span className="font-stat text-2xl text-primary leading-none">3</span>
            If it fits both ways, you pick a plan and you are in.
          </li>
        </ol>
        <p className="mt-8 text-sm text-muted-foreground">
          We emailed you a copy. Nothing in a week? WhatsApp Nasyir on
          688-6887 or Matthew on 724-5734.
        </p>
      </div>
    )
  }

  if (state.kind === 'screened') {
    return (
      <div className="bg-card border border-border rounded-[22px] p-8 md:p-10">
        <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-primary mb-4">
          Thanks for applying
        </p>
        <Display as="h2">Not yet — but soon.</Display>
        <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
          <p>
            Pinnacle is built for people who already train and want coaching
            to take it further, so we are not the right fit for a first gym.
            That is about our sessions, not about you.
          </p>
          <p>
            Give yourself six months of consistent training — three days a
            week, any gym, any program — and apply again. We would genuinely
            like to see you then.
          </p>
        </div>
        <div className="mt-8">
          <Pill href="/programs" variant="outline">
            See what we train
          </Pill>
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="bg-card border border-border rounded-[22px] p-6 md:p-10 space-y-8"
        noValidate
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input placeholder="Your name" autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone (WhatsApp)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="868 …"
                    inputMode="tel"
                    autoComplete="tel"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="experienceBracket"
          render={({ field }) => (
            <FormItem>
              <FormLabel>How long have you been training consistently?</FormLabel>
              <FormControl>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {EXPERIENCE_BRACKETS.map((b) => {
                    const on = field.value === b.value
                    return (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => field.onChange(b.value)}
                        aria-pressed={on}
                        className={cn(
                          'rounded-full px-5 py-4 text-sm font-semibold border transition-colors',
                          on
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-foreground hover:border-foreground'
                        )}
                      >
                        {b.label}
                      </button>
                    )
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="trainingNow"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What does your training look like right now?</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Where, how often, what kind of sessions"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="goal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What are you working toward?</FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder="Be specific — it helps" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            control={form.control}
            name="heardFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>How did you hear about Pinnacle?</FormLabel>
                <FormControl>
                  <Input placeholder="Instagram, a friend, drove past…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="referredBy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Referred by a member? (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Their name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="planInterest"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Plan you have in mind (optional)</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="">Not sure yet</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="codeAccepted"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-3">
                <FormControl>
                  <Checkbox
                    checked={field.value === true}
                    onCheckedChange={(v) => field.onChange(v === true ? true : undefined)}
                    className="mt-0.5"
                  />
                </FormControl>
                <FormLabel className="font-normal leading-relaxed cursor-pointer">
                  I&apos;ve read the Member Code and I&apos;ll train by it:
                  respect the equipment, respect people&apos;s space and time,
                  no filming others, show up for what I book.
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
          {...form.register('company')}
        />

        {state.kind === 'error' && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}

        <button
          type="submit"
          disabled={state.kind === 'submitting'}
          className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-8 py-4 text-base font-semibold hover:brightness-110 disabled:opacity-60"
        >
          {state.kind === 'submitting' ? 'Sending…' : 'Send my application'}
        </button>
      </form>
    </Form>
  )
}
