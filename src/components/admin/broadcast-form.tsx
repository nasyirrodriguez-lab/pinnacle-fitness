'use client'

import { useState, useTransition } from 'react'
import { AiFillCheckCircle } from 'react-icons/ai'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { previewAudience, sendBroadcastAction } from '@/app/admin/email/actions'

type Stage =
  | { kind: 'compose' }
  | {
      kind: 'previewed'
      total: number
      sample: { email: string; fullName: string | null }[]
      skippedOptedOut: number
    }
  | { kind: 'sending' }
  | {
      kind: 'sent'
      sent: number
      failed: number
      skipped: number
    }

export default function BroadcastForm() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [stage, setStage] = useState<Stage>({ kind: 'compose' })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onPreview = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (subject.trim().length === 0 || body.trim().length === 0) {
      setError('Subject and body are required.')
      return
    }
    startTransition(async () => {
      const result = await previewAudience({ audience: 'active-members' })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setStage({
        kind: 'previewed',
        total: result.total,
        sample: result.sample,
        skippedOptedOut: result.skippedOptedOut,
      })
    })
  }

  const onSend = () => {
    if (stage.kind !== 'previewed') return
    setError(null)
    setStage({ kind: 'sending' })
    startTransition(async () => {
      const result = await sendBroadcastAction({
        audience: 'active-members',
        subject: subject.trim(),
        bodyMarkdown: body,
        expectedRecipientCount: stage.total,
      })
      if (!result.ok) {
        setError(result.error)
        setStage({
          kind: 'previewed',
          total: stage.total,
          sample: stage.sample,
          skippedOptedOut: stage.skippedOptedOut,
        })
        return
      }
      setStage({
        kind: 'sent',
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
      })
    })
  }

  const onReset = () => {
    setStage({ kind: 'compose' })
    setSubject('')
    setBody('')
    setError(null)
  }

  if (stage.kind === 'sent') {
    return (
      <div className="text-center py-8">
        <AiFillCheckCircle className="mx-auto w-12 h-12 text-turquoise-500 mb-3" />
        <h2 className="font-heading text-xl mb-2">Broadcast sent</h2>
        <p className="text-neutral-600 mb-2">
          {stage.sent} delivered
          {stage.failed > 0 && ` · ${stage.failed} failed`}
          {stage.skipped > 0 &&
            ` · ${stage.skipped} skipped (already sent or opted out)`}
        </p>
        {stage.failed > 0 && (
          <p className="text-xs text-neutral-500 mb-4">
            Check the email_log table for failure details.
          </p>
        )}
        <Button variant="outline" onClick={onReset}>
          Send another broadcast
        </Button>
      </div>
    )
  }

  return (
    <div>
      <form onSubmit={onPreview} className="space-y-5">
        <div>
          <label htmlFor="subject" className="text-sm font-medium block mb-2">
            Subject
          </label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value)
              if (stage.kind !== 'compose') setStage({ kind: 'compose' })
            }}
            placeholder="e.g. New hours this month"
            disabled={isPending || stage.kind === 'sending'}
            maxLength={200}
            required
          />
        </div>

        <div>
          <label htmlFor="body" className="text-sm font-medium block mb-2">
            Body
          </label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              if (stage.kind !== 'compose') setStage({ kind: 'compose' })
            }}
            rows={12}
            placeholder="Plain text or basic Markdown. Blank lines separate paragraphs."
            disabled={isPending || stage.kind === 'sending'}
            maxLength={20000}
            required
          />
          <p className="text-xs text-neutral-500 mt-1">
            Greeting uses the recipient&apos;s first name. Unsubscribe link is
            appended automatically.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {stage.kind === 'compose' && (
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Previewing…' : 'Preview audience'}
          </Button>
        )}
      </form>

      {stage.kind === 'previewed' && (
        <div className="mt-6 border-t border-neutral-200 pt-6">
          <h3 className="font-heading text-lg mb-3">
            Ready to send to {stage.total}{' '}
            {stage.total === 1 ? 'recipient' : 'recipients'}
          </h3>
          {stage.skippedOptedOut > 0 && (
            <p className="text-xs text-neutral-500 mb-3">
              {stage.skippedOptedOut} unsubscribed{' '}
              {stage.skippedOptedOut === 1 ? 'address was' : 'addresses were'}{' '}
              skipped.
            </p>
          )}

          <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3 mb-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
              First 5 recipients
            </p>
            <ul className="text-sm text-neutral-700 space-y-0.5">
              {stage.sample.map((r) => (
                <li key={r.email}>
                  {r.fullName ?? '—'} ·{' '}
                  <span className="text-neutral-500">{r.email}</span>
                </li>
              ))}
            </ul>
          </div>

          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Sending real email to {stage.total} addresses. This cannot be
              undone. Double-check the subject and body above.
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-3">
            <Button onClick={onSend} disabled={isPending || stage.total === 0}>
              {isPending
                ? 'Sending…'
                : `Send to ${stage.total} ${stage.total === 1 ? 'recipient' : 'recipients'}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStage({ kind: 'compose' })}
              disabled={isPending}
            >
              Back to edit
            </Button>
          </div>
        </div>
      )}

      {stage.kind === 'sending' && (
        <div className="mt-6 border-t border-neutral-200 pt-6 text-center">
          <div className="inline-block w-6 h-6 border-2 border-neutral-200 border-t-turquoise-500 rounded-full animate-spin mb-2" />
          <p className="text-sm text-neutral-600">
            Sending… this can take a minute for large lists.
          </p>
        </div>
      )}
    </div>
  )
}
