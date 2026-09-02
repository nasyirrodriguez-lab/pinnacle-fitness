'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { adminAddNote } from '@/app/admin/members/[id]/actions'

interface Props {
  userId: string
}

export default function AdminNoteForm({ userId }: Props) {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (trimmed.length === 0) {
      setError('Note is required')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await adminAddNote({ userId, body: trimmed })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setBody('')
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Textarea
        rows={3}
        placeholder="Add a note (only visible to admins)…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={isPending}
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={isPending || body.trim().length === 0}>
        {isPending ? 'Saving…' : 'Add note'}
      </Button>
    </form>
  )
}
