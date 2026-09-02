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
import { updatePlan } from '@/app/admin/catalog/actions'

const schema = z.object({
  name: z.string().min(1, 'Required').max(120),
  description: z.string().max(2000).optional(),
  priceCents: z
    .string()
    .min(1, 'Required')
    .regex(/^\d+$/, 'Must be a whole number of cents'),
  discountedPriceCents: z
    .string()
    .regex(/^\d*$/, 'Must be a whole number of cents')
    .optional(),
  discountExpiresAt: z.string().optional(),
  discountLabel: z.string().max(80).optional(),
  featuresText: z.string().max(5000).optional(),
  isActive: z.boolean(),
  isPrivate: z.boolean(),
  isSpecialized: z.boolean(),
  ptSessions: z.string().regex(/^\d*$/, 'Whole number, or blank for unlimited').optional(),
  includesOpenGym: z.boolean(),
  openGymVisits: z.string().regex(/^\d*$/, 'Whole number, or blank').optional(),
  benefitsTouched: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  plan: {
    id: string
    name: string
    description: string
    priceCents: number
    discountedPriceCents: number | null
    discountExpiresAt: string | null
    discountLabel: string | null
    features: string[]
    isActive: boolean
    isPrivate: boolean
    isSpecialized: boolean
    groupSize: number | null
    ptSessionsPerMonth: number | null
    includesOpenGym: boolean
    openGymVisitsPerMonth: number | null
  }
}

export default function PlanEditForm({ plan }: Props) {
  const [groupSize, setGroupSize] = useState(
    plan.groupSize != null ? String(plan.groupSize) : ''
  )
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: plan.name,
      description: plan.description,
      priceCents: String(plan.priceCents),
      discountedPriceCents:
        plan.discountedPriceCents != null
          ? String(plan.discountedPriceCents)
          : '',
      discountExpiresAt: plan.discountExpiresAt
        ? plan.discountExpiresAt.slice(0, 10)
        : '',
      discountLabel: plan.discountLabel ?? '',
      featuresText: plan.features.join('\n'),
      isActive: plan.isActive,
      isPrivate: plan.isPrivate,
      isSpecialized: plan.isSpecialized,
      ptSessions: plan.ptSessionsPerMonth != null ? String(plan.ptSessionsPerMonth) : '',
      includesOpenGym: plan.includesOpenGym,
      openGymVisits: plan.openGymVisitsPerMonth != null ? String(plan.openGymVisitsPerMonth) : '',
      benefitsTouched: '',
    },
  })

  const onSubmit = (values: FormValues) => {
    setError(null)
    startTransition(async () => {
      const features = (values.featuresText ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      const result = await updatePlan({
        id: plan.id,
        name: values.name,
        description: values.description ?? null,
        priceCents: Number(values.priceCents),
        discountedPriceCents:
          values.discountedPriceCents && values.discountedPriceCents.length > 0
            ? Number(values.discountedPriceCents)
            : null,
        discountExpiresAt:
          values.discountExpiresAt && values.discountExpiresAt.length > 0
            ? values.discountExpiresAt
            : null,
        discountLabel:
          values.discountLabel && values.discountLabel.trim().length > 0
            ? values.discountLabel
            : null,
        features,
        isActive: values.isActive,
        isPrivate: values.isPrivate,
        isSpecialized: values.isSpecialized,
        ptSessionsPerMonth:
          values.ptSessions && values.ptSessions.length > 0
            ? Number(values.ptSessions)
            : null,
        includesOpenGym: values.includesOpenGym,
        openGymVisitsPerMonth:
          values.openGymVisits && values.openGymVisits.length > 0
            ? Number(values.openGymVisits)
            : null,
        groupSize:
          groupSize.trim().length > 0 && Number(groupSize) >= 2
            ? Number(groupSize)
            : null,
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

        <FormField
          control={form.control}
          name="priceCents"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price (cents)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-neutral-500">
                Enter cents (e.g. 100000 = $1,000 TTD)
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="border border-neutral-200 rounded-md p-4 space-y-4">
          <p className="text-sm font-medium">Discount</p>
          <FormField
            control={form.control}
            name="discountedPriceCents"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discounted price (cents)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Leave empty for no discount"
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
            name="discountExpiresAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount ends</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    disabled={isPending}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <p className="text-xs text-neutral-500">
                  Empty = runs until removed.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="discountLabel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Full Bloom"
                    disabled={isPending}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="featuresText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Features</FormLabel>
              <FormControl>
                <Textarea
                  rows={6}
                  disabled={isPending}
                  placeholder="One feature per line"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <p className="text-xs text-neutral-500">
                One feature per line. Blank lines are ignored.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
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
                Active (visible on /pricing)
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <label className="text-sm font-medium block mb-1.5">
            Group package (optional)
          </label>
          <Input
            type="number"
            min={2}
            max={50}
            placeholder="People included — blank = individual"
            value={groupSize}
            onChange={(e) => {
              setGroupSize(e.target.value)
              form.setValue('benefitsTouched', String(Math.random()), {
                shouldDirty: true,
              })
            }}
            disabled={isPending}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Marks this as a group package for that many people (e.g. 5).
          </p>
        </div>

        <div className="border border-neutral-200 rounded-md p-4 space-y-4">
          <div>
            <p className="text-sm font-medium">What this plan includes each month</p>
            <p className="text-xs text-neutral-500">
              Sessions reset on the renewal date — nothing rolls over.
            </p>
          </div>
          <FormField
            control={form.control}
            name="ptSessions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PT sessions per month</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    inputMode="numeric"
                    placeholder="Blank = unlimited · 0 = no PT"
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="includesOpenGym"
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
                  Includes open gym — walk in whenever there&apos;s room on the floor
                </FormLabel>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="openGymVisits"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Open-gym visits per month (if not unlimited)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    inputMode="numeric"
                    placeholder="Blank = not capped"
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isSpecialized"
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
                Specialized — mark this as a specialized offering
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isPrivate"
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
                Private — hidden from the website; only management can apply it
                via Record Payment
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
