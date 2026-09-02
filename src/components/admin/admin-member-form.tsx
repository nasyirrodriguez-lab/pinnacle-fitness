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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { adminUpdateMember } from '@/app/admin/members/[id]/actions'
import type { DesignationRole } from '@/lib/members/designations'

const schema = z.object({
  fullName: z.string().min(1, 'Required').max(120),
  phone: z.string().max(40).optional(),
  company: z.string().max(120).optional(),
  role: z.enum(['member', 'admin']),
  // 'none' is the UI sentinel for null — shadcn Select can't hold ''.
  designation: z.string().min(1).max(60),
  archived: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  userId: string
  designationOptions: DesignationRole[]
  defaultValues: {
    fullName: string
    phone: string
    company: string
    role: 'member' | 'admin'
    designation: string
    archived: boolean
  }
}

export default function AdminMemberForm({
  userId,
  designationOptions,
  defaultValues,
}: Props) {
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
      const result = await adminUpdateMember({
        userId,
        fullName: values.fullName,
        phone: values.phone ?? null,
        company: values.company ?? null,
        role: values.role,
        designation: values.designation === 'none' ? null : values.designation,
        archived: values.archived,
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
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
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input
                  type="tel"
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
              <FormLabel>Company</FormLabel>
              <FormControl>
                <Input
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
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isPending}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="archived"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Status</FormLabel>
                <label className="flex items-center gap-2 text-sm h-10 cursor-pointer">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    disabled={isPending}
                  />
                  Archived
                </label>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="designation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Designation</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {designationOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500">
                Designated members check in free — no pass needed or deducted.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-3 pt-2">
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
