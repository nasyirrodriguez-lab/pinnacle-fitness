'use client'

import { useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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
import { updateResource } from '@/app/admin/catalog/actions'

const intString = z
  .string()
  .min(1, 'Required')
  .regex(/^\d+$/, 'Whole number only')

const schema = z
  .object({
    name: z.string().min(1, 'Required').max(120),
    description: z.string().max(2000).optional(),
    capacity: intString,
    pricePerHourCents: z
      .string()
      .regex(/^\d*$/, 'Whole number or blank')
      .optional(),
    openHour: intString,
    closeHour: intString,
    slotMinutes: intString,
    isBookable: z.boolean(),
    requiresContact: z.boolean(),
  })
  .refine((v) => Number(v.closeHour) > Number(v.openHour), {
    message: 'Close hour must be after open hour',
    path: ['closeHour'],
  })

type FormValues = z.infer<typeof schema>

interface Props {
  resource: {
    id: string
    name: string
    description: string
    capacity: number
    pricePerHourCents: number | null
    openHour: number
    closeHour: number
    slotMinutes: number
    isBookable: boolean
    requiresContact: boolean
  }
}

export default function ResourceEditForm({ resource }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: resource.name,
      description: resource.description,
      capacity: String(resource.capacity),
      pricePerHourCents:
        resource.pricePerHourCents != null
          ? String(resource.pricePerHourCents)
          : '',
      openHour: String(resource.openHour),
      closeHour: String(resource.closeHour),
      slotMinutes: String(resource.slotMinutes),
      isBookable: resource.isBookable,
      requiresContact: resource.requiresContact,
    },
  })

  const onSubmit = (values: FormValues) => {
    setError(null)
    startTransition(async () => {
      const pricePerHour =
        values.pricePerHourCents && values.pricePerHourCents.length > 0
          ? Number(values.pricePerHourCents)
          : null
      const result = await updateResource({
        id: resource.id,
        name: values.name,
        description: values.description ?? null,
        capacity: Number(values.capacity),
        pricePerHourCents: pricePerHour,
        openHour: Number(values.openHour),
        closeHour: Number(values.closeHour),
        slotMinutes: Number(values.slotMinutes),
        isBookable: values.isBookable,
        requiresContact: values.requiresContact,
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input disabled={isPending} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  disabled={isPending}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    step={1}
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
            name="pricePerHourCents"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price per hour (cents)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    disabled={isPending}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <p className="text-xs text-neutral-500">
                  Blank for contact-only resources
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="openHour"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Open hour</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    step={1}
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
            name="closeHour"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Close hour</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    step={1}
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
            name="slotMinutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slot minutes</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={15}
                    max={240}
                    step={15}
                    disabled={isPending}
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
          name="isBookable"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  disabled={isPending}
                />
              </FormControl>
              <FormLabel className="font-normal text-sm cursor-pointer">
                Bookable (shows in /book)
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="requiresContact"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  disabled={isPending}
                />
              </FormControl>
              <FormLabel className="font-normal text-sm cursor-pointer">
                Inquire-only (e.g. event space)
              </FormLabel>
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
