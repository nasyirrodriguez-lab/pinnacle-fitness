'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { cn } from '@/lib/utils'
import { inquirySchema, type InquiryFormData } from '@/lib/schemas/inquiry'

const TOPICS = ['Membership', 'Personal training', 'Open gym', 'Something else']

type State = 'idle' | 'submitting' | 'error' | 'success'

type InquiryFormProps = {
  defaultInterests?: string[]
}

export default function InquiryForm({ defaultInterests }: InquiryFormProps) {
  const [state, setState] = useState<State>('idle')

  const form = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      name: '',
      email: '',
      interests: defaultInterests ?? [],
      message: '',
    },
  })

  const onSubmit = async (data: InquiryFormData) => {
    try {
      setState('submitting')
      const res = await fetch('/api/inquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to send')
      setState('success')
    } catch (error) {
      console.error(error)
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="py-6">
        <p className="font-heading font-bold uppercase text-xl mb-2">
          Got it.
        </p>
        <p className="text-muted-foreground">
          One of the coaches will get back to you. If it&apos;s urgent,
          WhatsApp is faster.
        </p>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Your name"
                    disabled={state === 'submitting'}
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
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    disabled={state === 'submitting'}
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
          name="interests"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What&apos;s it about?</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-2 pt-1">
                  {TOPICS.map((topic) => {
                    const on = field.value?.includes(topic)
                    return (
                      <button
                        key={topic}
                        type="button"
                        disabled={state === 'submitting'}
                        aria-pressed={on}
                        onClick={() => {
                          const current = field.value ?? []
                          field.onChange(
                            on
                              ? current.filter((v) => v !== topic)
                              : [...current, topic]
                          )
                        }}
                        className={cn(
                          'rounded-full px-4 py-2 text-sm font-semibold border transition-colors',
                          on
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-foreground hover:border-foreground'
                        )}
                      >
                        {topic}
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
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="What can we help with?"
                  disabled={state === 'submitting'}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {state === 'error' && (
          <p className="text-sm text-destructive">
            That didn&apos;t send. Try again, or WhatsApp us.
          </p>
        )}
        <button
          type="submit"
          disabled={state === 'submitting'}
          className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-7 py-3 text-sm font-semibold hover:brightness-110 disabled:opacity-60"
        >
          {state === 'submitting' ? 'Sending…' : 'Send'}
        </button>
      </form>
    </Form>
  )
}
