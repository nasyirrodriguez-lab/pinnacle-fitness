'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { AiFillCheckCircle } from 'react-icons/ai'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { SERVICES } from '@/constants/constants'
import { inquirySchema, type InquiryFormData } from '@/lib/schemas/inquiry'

const INTEREST_OPTIONS = SERVICES.map((s) => s.name)

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
      <div className="flex flex-col items-center gap-4 py-8">
        <AiFillCheckCircle className="block w-20 h-20 text-turquoise-500" />
        <h3 className="text-xl">Thanks for reaching out!</h3>
        <p className="text-center">
          We&apos;ve received your inquiry and will get back to you soon.
        </p>
      </div>
    )
  }

  return (
    <div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                      placeholder="Your email address"
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
            render={() => (
              <FormItem>
                <FormLabel>What are you interested in?</FormLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  {INTEREST_OPTIONS.map((option) => (
                    <FormField
                      key={option}
                      control={form.control}
                      name="interests"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(option)}
                              disabled={state === 'submitting'}
                              onCheckedChange={(checked) => {
                                const current = field.value ?? []
                                field.onChange(
                                  checked
                                    ? [...current, option]
                                    : current.filter((v) => v !== option)
                                )
                              }}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal cursor-pointer">
                            {option}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tell us a little more</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Anything else you'd like us to know?"
                    rows={4}
                    disabled={state === 'submitting'}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={state === 'submitting'}>
            {state === 'submitting' ? 'Sending…' : 'Send Inquiry'}
          </Button>
        </form>
      </Form>
      {state === 'error' && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>
            Something went wrong. Please try again or contact us at{' '}
            <a href="mailto:team@theworx.io" className="underline">
              team@theworx.io
            </a>
            .
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
