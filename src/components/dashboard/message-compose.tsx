'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { sendMessageToTeam } from '@/app/dashboard/messages/actions'

export default function MessageCompose() {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await sendMessageToTeam({ body: body.trim() })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setBody('')
      router.refresh()
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-neutral-200 rounded-lg p-5 mb-6"
    >
      <p className="text-sm font-medium mb-2">Message the team</p>
      <Textarea
        rows={3}
        placeholder="Questions, requests, feedback — we read everything."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={isPending}
        maxLength={5000}
      />
      {error && <p className="text-xs text-red-700 mt-2">{error}</p>}
      <div className="mt-3">
        <Button type="submit" size="sm" disabled={isPending || !body.trim()}>
          <Send size={14} className="mr-1.5" />
          {isPending ? 'Sending…' : 'Send to The Worx team'}
        </Button>
      </div>
    </form>
  )
}
