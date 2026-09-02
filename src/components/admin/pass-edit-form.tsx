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
import { updatePass } from '@/app/admin/catalog/actions'

const intString = z
  .string()
  .min(1, 'Required')
  .regex(/^\d+$/, 'Whole number only')

const schema = z.object({
  name: z.string().min(1, 'Required').max(120),
  description: z.string().max(2000).optional(),
  priceCents: intString,
  discountedPriceCents: z
    .string()
    .regex(/^\d*$/, 'Whole number or blank')
    .optional(),
  discountExpiresAt: z.string().optional(),
  discountLabel: z.string().max(80).optional(),
  usesTotal: intString,
  validityDays: intString,
  featuresText: z.string().max(5000).optional(),
  isActive: z.boolean(),
  isPrivate: z.boolean(),
  isSpecialized: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  pass: {
    id: string
    name: string
    description: string
    priceCents: number
    discountedPriceCents: number | null
    discountExpiresAt: string | null
    discountLabel: string | null
    usesTotal: number
    validityDays: number
    features: string[]
    isActive: boolean
    isPrivate: boolean
    isSpecialized: boolean
    groupSize: number | null
  }
}

export default function PassEditForm({ pass }: Props) {
  const [groupSize, setGroupSize] = useState(
    pass.groupSize != null ? String(pass.groupSize) : ''
  )
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: pass.name,
      description: pass.description,
      priceCents: String(pass.priceCents),
      discountedPriceCents:
        pass.discountedPriceCents != null
          ? String(pass.discountedPriceCents)
          : '',
      discountExpiresAt: pass.discountExpiresAt
        ? pass.discountExpiresAt.slice(0, 10)
        : '',
      discountLabel: pass.discountLabel ?? '',
      usesTotal: String(pass.usesTotal),
      validityDays: String(pass.validityDays),
      featuresText: pass.features.join('\n'),
      isActive: pass.isActive,
      isPrivate: pass.isPrivate,
      isSpecialized: pass.isSpecialized,
    },
  })

  const onSubmit = (values: FormValues) => {
    setError(null)
    startTransition(async () => {
      const features = (values.featuresText ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      const discounted =
        values.discountedPriceCents && values.discountedPriceCents.length > 0
          ? Number(values.discountedPriceCents)
          : null
      const result = await updatePass({
        id: pass.id,
        name: values.name,
        description: values.description ?? null,
        priceCents: Number(values.priceCents),
        discountedPriceCents: discounted,
        discountExpiresAt:
          values.discountExpiresAt && values.discountExpiresAt.length > 0
            ? values.discountExpiresAt
            : null,
        discountLabel:
          values.discountLabel && values.discountLabel.trim().length > 0
            ? values.discountLabel
            : null,
        usesTotal: Number(values.usesTotal),
        validityDays: Number(values.validityDays),
        features,
        isActive: values.isActive,
        isPrivate: values.isPrivate,
        isSpecialized: values.isSpecialized,
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

        <div className="grid grid-cols-2 gap-4">
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
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="discountedPriceCents"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discounted (cents, optional)</FormLabel>
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
                  Leave blank for no discount
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="usesTotal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Days included</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={365}
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
            name="validityDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valid for (days)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    step={1}
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
                Active (visible on /spaces and /buy)
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
            onChange={(e) => setGroupSize(e.target.value)}
            disabled={isPending}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Marks this as a group pass for that many people (e.g. 5).
          </p>
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
