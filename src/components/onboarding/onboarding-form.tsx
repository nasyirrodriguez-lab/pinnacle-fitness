'use client'

import { useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { CheckCircle2 } from 'lucide-react'
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
import TermsContent from '@/components/terms/terms-content'
import SelfieCapture from '@/components/selfie-capture/selfie-capture'
import { completeOnboarding } from '@/app/welcome/actions'
import { CURRENT_TERMS_LAST_UPDATED } from '@/config/terms'

const schema = z.object({
  fullName: z.string().min(1, 'Your name is required').max(120),
  phone: z
    .string()
    .trim()
    .min(7, 'A contact number is required')
    .max(40)
    .regex(/^\+?[\d\s\-()]{7,}$/, 'Enter a valid phone number'),
  acceptTerms: z
    .boolean()
    .refine(
      (v) => v === true,
      'You must accept the Terms and Conditions to continue'
    ),
})

type FormValues = z.infer<typeof schema>

interface Props {
  defaultFullName: string
  defaultPhone: string
  next?: string
}

export default function OnboardingForm({
  defaultFullName,
  defaultPhone,
  next,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [selfieUploading, setSelfieUploading] = useState(false)
  const [selfieSaved, setSelfieSaved] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: defaultFullName,
      phone: defaultPhone,
      acceptTerms: false,
    },
  })

  const handleSelfie = async (blob: Blob) => {
    setError(null)
    setSelfieUploading(true)
    try {
      const fd = new FormData()
      fd.append('selfie', blob, 'selfie.jpg')
      const res = await fetch('/api/profile/selfie', {
        method: 'POST',
        body: fd,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Could not save selfie. Try again.')
        return
      }
      setSelfieSaved(true)
    } catch {
      setError('Network error while saving selfie. Try again.')
    } finally {
      setSelfieUploading(false)
    }
  }

  const onSubmit = (values: FormValues) => {
    setError(null)
    if (!selfieSaved) {
      setError('Take a selfie before continuing.')
      return
    }
    startTransition(async () => {
      const result = await completeOnboarding({
        fullName: values.fullName,
        phone: values.phone,
        acceptTerms: true,
        next,
      })
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your full name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Jane Doe"
                  autoComplete="name"
                  disabled={isPending}
                  {...field}
                />
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
              <FormLabel>Phone number</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="868 555 1234"
                  autoComplete="tel"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-neutral-500">
                So we can reach you about your bookings and visits.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <p className="text-sm font-medium mb-2">
            Terms and Conditions ({CURRENT_TERMS_LAST_UPDATED})
          </p>
          <TermsContent scrollable />
        </div>

        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  disabled={isPending}
                />
              </FormControl>
              <div className="space-y-1 leading-tight">
                <FormLabel className="font-normal text-sm cursor-pointer">
                  I have read and agree to The Worx Terms and Conditions and the
                  House Rules.
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <div className="border-t border-neutral-200 pt-6">
          <p className="text-sm font-medium mb-1">A quick selfie</p>
          <p className="text-xs text-neutral-500 mb-4">
            So we can recognize you at the door. Stays private &mdash; only the
            team can see it.
          </p>
          {selfieSaved ? (
            <div className="flex items-center gap-2 rounded-md bg-turquoise-50 border border-turquoise-200 px-3 py-2 text-sm text-turquoise-900">
              <CheckCircle2 size={16} />
              Selfie saved. You can retake it later from your dashboard.
            </div>
          ) : (
            <SelfieCapture
              busy={selfieUploading}
              onCapture={handleSelfie}
              confirmLabel="Save selfie"
            />
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          disabled={isPending || !selfieSaved}
          className="w-full"
        >
          {isPending
            ? 'Saving…'
            : selfieSaved
              ? 'Continue'
              : 'Take a selfie to continue'}
        </Button>
      </form>
    </Form>
  )
}
