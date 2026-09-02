'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { adminCreateMember } from '@/app/admin/members/new/actions'
import type { DesignationRole } from '@/lib/members/designations'

export default function AdminCreateMemberForm({
  designationOptions,
}: {
  designationOptions: DesignationRole[]
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [designation, setDesignation] = useState('none')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await adminCreateMember({
        email: email.trim(),
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        designation: designation === 'none' ? null : designation,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/admin/members/${result.userId}`)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium block mb-1.5">Full name</label>
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Doe"
          disabled={isPending}
          maxLength={120}
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1.5">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          disabled={isPending}
          maxLength={200}
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1.5">
          Phone (optional)
        </label>
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="868 555 1234"
          disabled={isPending}
          maxLength={40}
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1.5">Designation</label>
        <Select
          value={designation}
          onValueChange={setDesignation}
          disabled={isPending}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {designationOptions.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={isPending || !email.trim() || !fullName.trim()}
      >
        {isPending ? 'Creating…' : 'Create account & send invite'}
      </Button>
      <p className="text-xs text-neutral-500">
        They&apos;ll get a sign-in email right away. Their first sign-in walks
        them through terms and a selfie; the name and phone here are pre-filled
        for them.
      </p>
    </form>
  )
}
