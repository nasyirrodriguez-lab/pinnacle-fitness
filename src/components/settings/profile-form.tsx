'use client'

import { useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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
import { updateProfile } from '@/app/dashboard/settings/actions'

const schema = z.object({
  fullName: z.string().min(1, 'Your name is required').max(120),
  phone: z.string().max(40).optional(),
  company: z.string().max(120).optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  defaultValues: {
    fullName: string
    phone: string
    company: string
  }
  email: string
}

export default function ProfileForm({ defaultValues, email }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const onSubmit = (values: FormValues) => {
    setError(null)
    startTransition(async () => {
      const result = await updateProfile({
        fullName: values.fullName,
        phone: values.phone ?? null,
        company: values.company ?? null,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSavedAt(Date.now())
      form.reset(values)
    })
  }

  const isDirty = form.formState.isDirty
  const showSaved = savedAt && !isDirty

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
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

        <div>
          <label className="text-sm font-medium block mb-2">Email</label>
          <p className="text-sm text-neutral-500 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md">
            {email}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            Email is locked. Email team@theworx.io to change it.
          </p>
        </div>

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="+1 (868) 000-0000"
                  autoComplete="tel"
                  disabled={isPending}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="company"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="The Worx"
                  autoComplete="organization"
                  disabled={isPending}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending || !isDirty}>
            {isPending ? 'Saving…' : 'Save changes'}
          </Button>
          {showSaved && (
            <span className="inline-flex items-center gap-1 text-sm text-neutral-600">
              <AiFillCheckCircle className="text-turquoise-500" />
              Saved
            </span>
          )}
        </div>
      </form>
    </Form>
  )
}
