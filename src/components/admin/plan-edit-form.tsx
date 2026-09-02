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
  includesDayAccess: z.boolean(),
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
    includesDayAccess: boolean
    roomBenefits: {
      resourceId: string
      unit: 'minutes' | 'hours' | 'days' | 'months'
      amount: number
      maxHoursPerDay: number | null
    }[]
  }
  resources: { id: string; name: string }[]
}

export default function PlanEditForm({ plan, resources }: Props) {
  const [groupSize, setGroupSize] = useState(
    plan.groupSize != null ? String(plan.groupSize) : ''
  )
  const [benefits, setBenefits] = useState<
    Record<string, { unit: string; amount: string; day: string }>
  >(() => {
    const initial: Record<
      string,
      { unit: string; amount: string; day: string }
    > = {}
    for (const b of plan.roomBenefits) {
      initial[b.resourceId] = {
        unit: b.unit,
        amount: String(b.amount),
        day: b.maxHoursPerDay != null ? String(b.maxHoursPerDay) : '',
      }
    }
    return initial
  })
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
      includesDayAccess: plan.includesDayAccess,
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
        includesDayAccess: values.includesDayAccess,
        groupSize:
          groupSize.trim().length > 0 && Number(groupSize) >= 2
            ? Number(groupSize)
            : null,
        roomBenefits: Object.entries(benefits)
          .map(([resourceId, v]) => ({
            resourceId,
            unit: (v.unit || 'hours') as
              | 'minutes'
              | 'hours'
              | 'days'
              | 'months',
            amount: Number.parseFloat(v.amount),
            maxHoursPerDay:
              v.day.trim().length > 0 ? Number.parseFloat(v.day) : null,
          }))
          .filter((b) => Number.isFinite(b.amount) && b.amount > 0),
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
                Active (visible on /spaces)
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

        <FormField
          control={form.control}
          name="includesDayAccess"
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
                Includes daily workspace access — members on this plan check in
                free (hot desk / day pass access)
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="border border-neutral-200 rounded-md p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Room access included</p>
            <p className="text-xs text-neutral-500">
              What this plan includes on each space, per month — pick a unit
              (minutes, hours, days, or months = unlimited) and an amount, plus
              an optional daily cap. Days count as 8 hours, max 30. Blank amount
              = not included. Covered time books free; anything beyond is
              charged normally.
            </p>
          </div>
          {resources.map((r) => {
            const value = benefits[r.id] ?? {
              unit: 'hours',
              amount: '',
              day: '',
            }
            const update = (
              patch: Partial<{ unit: string; amount: string; day: string }>
            ) => {
              setBenefits((prev) => ({
                ...prev,
                [r.id]: { ...value, ...patch },
              }))
              form.setValue('benefitsTouched', String(Math.random()), {
                shouldDirty: true,
              })
            }
            return (
              <div key={r.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">{r.name}</span>
                  <div className="flex rounded-md border border-neutral-200 overflow-hidden">
                    {(
                      [
                        ['minutes', 'Min'],
                        ['hours', 'Hrs'],
                        ['days', 'Days'],
                        ['months', 'Mths'],
                      ] as const
                    ).map(([unit, label]) => (
                      <button
                        key={unit}
                        type="button"
                        disabled={isPending}
                        onClick={() => update({ unit })}
                        className={
                          value.unit === unit
                            ? 'px-2.5 py-1 text-xs font-medium bg-darkBlue-900 text-white'
                            : 'px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50'
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder={
                      value.unit === 'months'
                        ? 'months included'
                        : `${value.unit}/month`
                    }
                    value={value.amount}
                    onChange={(e) => update({ amount: e.target.value })}
                    disabled={isPending}
                    className="h-9"
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="max hrs/day"
                    value={value.day}
                    onChange={(e) => update({ day: e.target.value })}
                    disabled={isPending || value.unit === 'months'}
                    className="h-9"
                  />
                </div>
              </div>
            )
          })}
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
