'use client'

import { useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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
import {
  VO_AGREEMENT_INTRO,
  VO_AGREEMENT_SECTIONS,
  VO_AGREEMENT_VERSION,
  VO_DOCUMENT_KINDS,
  VO_REGISTERED_ADDRESS,
  type VODocumentKind,
} from '@/config/virtual-office'
import { startVirtualOfficeSignup } from '@/app/virtual-office/actions'
import VirtualOfficeDocumentUploader from './document-uploader'

interface InitialDoc {
  id: string
  kind: VODocumentKind
  status: 'pending' | 'approved' | 'rejected'
  original_filename: string | null
  created_at: string
}

const schema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(200),
  intendedUse: z.string().max(2000).optional(),
  forwardingEmail: z
    .union([z.string().email('Enter a valid email'), z.literal('')])
    .optional(),
  acceptAgreement: z
    .boolean()
    .refine((v) => v === true, 'You must accept the agreement to continue'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  priceLabel: string
  defaultName?: string
  defaultCompany?: string
  initialDocuments?: InitialDoc[]
}

export default function VirtualOfficeSignupForm({
  priceLabel,
  defaultCompany = '',
  initialDocuments = [],
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const initialReady = VO_DOCUMENT_KINDS.every((k) =>
    initialDocuments.some((d) => d.kind === k)
  )
  const [docsReady, setDocsReady] = useState(initialReady)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: defaultCompany,
      intendedUse: '',
      forwardingEmail: '',
      acceptAgreement: false,
    },
  })

  const onSubmit = (values: FormValues) => {
    setError(null)
    startTransition(async () => {
      const result = await startVirtualOfficeSignup({
        businessName: values.businessName,
        intendedUse: values.intendedUse,
        forwardingEmail: values.forwardingEmail || undefined,
        acceptAgreement: values.acceptAgreement,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      window.location.href = result.checkoutUrl
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="businessName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business name</FormLabel>
              <FormControl>
                <Input
                  placeholder="The Worx Ltd."
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-neutral-500">
                This is the name we&apos;ll accept mail under.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="intendedUse"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Intended use (optional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="e.g. company registration, mailing address for customers"
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
          name="forwardingEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notification email (optional)</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="Defaults to your account email"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-neutral-500">
                Where you want new-mail notifications to go, if different from
                your account email.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <p className="text-sm font-medium mb-1">Required documents</p>
          <p className="text-xs text-neutral-500 mb-3">
            For compliance with Trinidad &amp; Tobago business address rules, we
            need three documents before we can activate your Virtual Office.
            Files are kept private and only used to verify your signup.
          </p>
          <VirtualOfficeDocumentUploader
            initial={initialDocuments}
            onChange={(byKind) => {
              const allPresent = VO_DOCUMENT_KINDS.every((k) => byKind[k])
              setDocsReady(allPresent)
            }}
          />
        </div>

        <div className="border border-neutral-200 rounded-md">
          <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-200">
            <p className="text-sm font-medium">
              Virtual Office Agreement (v{VO_AGREEMENT_VERSION})
            </p>
          </div>
          <div className="px-4 py-3 max-h-72 overflow-y-auto text-sm text-neutral-700 leading-relaxed">
            <p className="mb-3">{VO_AGREEMENT_INTRO}</p>
            <p className="mb-3 font-medium">
              Registered address: {VO_REGISTERED_ADDRESS}
            </p>
            {VO_AGREEMENT_SECTIONS.map((section) => (
              <section key={section.title} className="mb-4 last:mb-0">
                <h4 className="font-heading text-sm mb-1">{section.title}</h4>
                {section.body.map((p, i) => (
                  <p key={i} className="text-xs text-neutral-700 mb-1">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>

        <FormField
          control={form.control}
          name="acceptAgreement"
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
                  I agree to the Virtual Office terms above. I understand this
                  is a non-binding statement of intent and that The Worx may
                  withdraw permission with 30 days notice.
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          disabled={isPending || !docsReady}
          className="w-full"
        >
          {isPending
            ? 'Taking you to Wam…'
            : docsReady
              ? `Pay ${priceLabel} & start`
              : 'Upload required documents to continue'}
        </Button>
      </form>
    </Form>
  )
}
