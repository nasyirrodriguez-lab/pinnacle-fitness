'use client'

import { useState, useTransition } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { adminLogMail } from '@/app/admin/virtual-office/actions'

interface Props {
  userId: string
}

export default function LogMailForm({ userId }: Props) {
  const [sender, setSender] = useState('')
  const [label, setLabel] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const r = await adminLogMail({
        userId,
        sender: sender.trim() || undefined,
        label: label.trim() || undefined,
        notes: notes.trim() || undefined,
        photoUrl: photoUrl.trim() || undefined,
      })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setSender('')
      setLabel('')
      setPhotoUrl('')
      setNotes('')
      setSuccess(true)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sender">Sender (optional)</Label>
          <Input
            id="sender"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="e.g. TTPost, FedEx, ABC Bank"
            disabled={isPending}
          />
        </div>
        <div>
          <Label htmlFor="label">Item label (optional)</Label>
          <Input
            id="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Letter, Small parcel"
            disabled={isPending}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="photoUrl">Photo URL (optional)</Label>
        <Input
          id="photoUrl"
          type="url"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://… (paste a Supabase Storage public URL)"
          disabled={isPending}
        />
        <p className="text-xs text-neutral-500 mt-1">
          Upload the photo to the <code>virtual-office-mail</code> bucket in
          Supabase Storage, then paste the public URL here.
        </p>
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the member should know about this item"
          disabled={isPending}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>
            Mail item logged. The member has been emailed.
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Logging…' : 'Log mail item'}
      </Button>
    </form>
  )
}
