'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  adminSendNotification,
  adminSendToGroup,
} from '@/app/admin/notifications/actions'

export interface MessageGroupOption {
  id: string
  name: string
}

interface Props {
  defaultRecipient?: string
  groups?: MessageGroupOption[]
}

// Audience picker: everyone, a saved group, or one member by email.
export default function AdminNotificationComposer({
  defaultRecipient = '',
  groups = [],
}: Props) {
  const router = useRouter()
  const [audience, setAudience] = useState(
    defaultRecipient ? 'email' : 'everyone'
  )
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipient)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSent(null)
    startTransition(async () => {
      const result = audience.startsWith('group:')
        ? await adminSendToGroup({
            groupId: audience.slice('group:'.length),
            title: title.trim(),
            body: body.trim(),
          })
        : await adminSendNotification({
            title: title.trim(),
            body: body.trim(),
            recipientEmail: audience === 'email' ? recipientEmail.trim() : '',
          })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSent(`Message sent to ${result.audience}.`)
      setTitle('')
      setBody('')
      setRecipientEmail('')
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium block mb-1.5">To</label>
        <Select
          value={audience}
          onValueChange={setAudience}
          disabled={isPending}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="everyone">All members</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={`group:${g.id}`}>
                Group: {g.name}
              </SelectItem>
            ))}
            <SelectItem value="email">One member (by email)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {audience === 'email' && (
        <div>
          <Input
            type="email"
            placeholder="member@example.com"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            disabled={isPending}
            maxLength={200}
          />
        </div>
      )}
      <div>
        <label className="text-sm font-medium block mb-1.5">Subject</label>
        <Input
          placeholder="e.g. AC maintenance this Friday"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isPending}
          maxLength={150}
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1.5">Message</label>
        <Textarea
          rows={6}
          placeholder="What do members need to know?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isPending}
          maxLength={5000}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {sent && <p className="text-sm text-turquoise-700">{sent}</p>}

      <Button
        type="submit"
        disabled={
          isPending ||
          !title.trim() ||
          !body.trim() ||
          (audience === 'email' && !recipientEmail.trim())
        }
      >
        <Send size={15} className="mr-1.5" />
        {isPending ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  )
}
