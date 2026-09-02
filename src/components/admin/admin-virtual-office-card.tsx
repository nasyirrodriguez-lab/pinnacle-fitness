'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  adminCreateVirtualOffice,
  adminSetVirtualOfficeActive,
} from '@/app/admin/virtual-office/actions'

interface VirtualOfficeInfo {
  businessName: string
  forwardingEmail: string | null
  isActive: boolean
}

interface Props {
  userId: string
  vo: VirtualOfficeInfo | null
}

export default function AdminVirtualOfficeCard({ userId, vo }: Props) {
  const router = useRouter()
  const [businessName, setBusinessName] = useState('')
  const [forwardingEmail, setForwardingEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (vo) {
    return (
      <div className="space-y-3">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
              Business
            </dt>
            <dd className="font-medium">{vo.businessName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
              Mail notifications
            </dt>
            <dd className="font-medium">
              {vo.forwardingEmail ?? 'Account email'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
              Status
            </dt>
            <dd>
              <span
                className={
                  vo.isActive
                    ? 'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-lime-100 text-lime-900'
                    : 'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-neutral-200 text-neutral-700'
                }
              >
                {vo.isActive ? 'Active' : 'Inactive'}
              </span>
            </dd>
          </div>
        </dl>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Link
            href={`/admin/virtual-office/${userId}`}
            className="text-xs text-darkBlue-900 hover:underline"
          >
            Mail & documents →
          </Link>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              setError(null)
              startTransition(async () => {
                const result = await adminSetVirtualOfficeActive({
                  userId,
                  isActive: !vo.isActive,
                })
                if (!result.ok) {
                  setError(result.error)
                  return
                }
                router.refresh()
              })
            }}
          >
            {isPending ? 'Saving…' : vo.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      </div>
    )
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = businessName.trim()
    if (trimmed.length === 0) {
      setError('Business name is required')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await adminCreateVirtualOffice({
        userId,
        businessName: trimmed,
        forwardingEmail: forwardingEmail.trim(),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-neutral-500 flex items-start gap-2">
        <Mail size={14} className="mt-0.5 shrink-0" />
        No virtual office on file. Set one up here for members who signed up in
        person — mail logging and notifications start right away.
      </p>
      <Input
        placeholder="Registered business name"
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        disabled={isPending}
        maxLength={200}
      />
      <Input
        type="email"
        placeholder="Mail notification email (optional)"
        value={forwardingEmail}
        onChange={(e) => setForwardingEmail(e.target.value)}
        disabled={isPending}
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        disabled={isPending || businessName.trim().length === 0}
      >
        {isPending ? 'Setting up…' : 'Set up virtual office'}
      </Button>
    </form>
  )
}
