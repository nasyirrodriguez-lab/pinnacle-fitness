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
import { Textarea } from '@/components/ui/textarea'
import { referralSchema, type ReferralInput } from '@/lib/schemas/referral'

type State = 'idle' | 'submitting' | 'error' | 'success'

export default function ReferralForm() {
  const [state, setState] = useState<State>('idle')

  const form = useForm<ReferralInput>({
    resolver: zodResolver(referralSchema),
    defaultValues: { friendName: '', friendEmail: '', note: '' },
  })

  const onSubmit = async (data: ReferralInput) => {
    try {
      setState('submitting')
      const res = await fetch('/api/refer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to send')
      setState('success')
      form.reset()
    } catch (err) {
      console.error(err)
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AiFillCheckCircle className="block w-14 h-14 text-turquoise-500" />
        <h2 className="font-heading text-xl">Referral sent</h2>
        <p className="text-sm text-neutral-600 max-w-sm">
          The team will reach out to your friend. Thanks for growing the
          community.
        </p>
        <button
          type="button"
          className="text-sm text-turquoise-700 underline mt-2"
          onClick={() => setState('idle')}
        >
          Refer someone else
        </button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="friendName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Their name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Jane Doe"
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
          name="friendEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Their email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="jane@example.com"
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
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (optional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="Tell us a bit about them — what they do, why they'd love the space."
                  disabled={state === 'submitting'}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {state === 'error' && (
          <Alert variant="destructive">
            <AlertDescription>
              Something went wrong sending your referral. Try again.
            </AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={state === 'submitting'}>
          {state === 'submitting' ? 'Sending…' : 'Send referral'}
        </Button>
      </form>
    </Form>
  )
}
