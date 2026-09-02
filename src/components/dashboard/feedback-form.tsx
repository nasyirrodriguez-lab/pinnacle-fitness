'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AiFillCheckCircle } from 'react-icons/ai'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { submitFeedback } from '@/app/dashboard/feedback/[id]/actions'

interface Question {
  prompt: string
  type: 'text' | 'rating'
}

export default function FeedbackForm({
  formId,
  questions,
  existingAnswers,
}: {
  formId: string
  questions: Question[]
  existingAnswers: (string | number | null)[] | null
}) {
  const [answers, setAnswers] = useState<(string | number | null)[]>(
    existingAnswers ?? questions.map(() => null)
  )
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (done) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-10 text-center">
        <AiFillCheckCircle className="mx-auto w-12 h-12 text-turquoise-500 mb-3" />
        <h2 className="font-heading text-xl mb-2">Thank you!</h2>
        <p className="text-sm text-neutral-600 mb-6">
          Your feedback is in — it genuinely shapes what we do next.
        </p>
        <Link href="/dashboard">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    )
  }

  const setAnswer = (i: number, v: string | number | null) => {
    setAnswers((a) => a.map((x, j) => (j === i ? v : x)))
  }

  return (
    <div className="space-y-6">
      {questions.map((q, i) => (
        <div
          key={i}
          className="bg-white border border-neutral-200 rounded-lg p-5"
        >
          <p className="font-medium text-sm mb-3">{q.prompt}</p>
          {q.type === 'rating' ? (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAnswer(i, v)}
                  className={
                    answers[i] === v
                      ? 'w-10 h-10 rounded-md bg-turquoise-500 text-white font-bold'
                      : 'w-10 h-10 rounded-md border border-neutral-300 text-neutral-700 hover:border-turquoise-400'
                  }
                >
                  {v}
                </button>
              ))}
            </div>
          ) : (
            <Textarea
              rows={3}
              value={
                typeof answers[i] === 'string' ? (answers[i] as string) : ''
              }
              onChange={(e) => setAnswer(i, e.target.value)}
              placeholder="Your thoughts…"
              maxLength={5000}
            />
          )}
        </div>
      ))}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <Button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const r = await submitFeedback({ formId, answers })
            if (!r.ok) {
              setError(r.error)
              return
            }
            setDone(true)
          })
        }}
      >
        {isPending ? 'Sending…' : 'Submit feedback'}
      </Button>
    </div>
  )
}
