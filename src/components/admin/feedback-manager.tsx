'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  adminCreateFeedbackForm,
  adminCloseFeedbackForm,
  adminSendFeedbackForm,
} from '@/app/admin/feedback/actions'
import { fmtAstDate } from '@/lib/time/ast'

interface Question {
  prompt: string
  type: 'text' | 'rating'
}

export interface FeedbackFormRow {
  id: string
  title: string
  isOpen: boolean
  sentAt: string | null
  createdAt: string
  responseCount: number
}

export default function FeedbackManager({
  forms,
}: {
  forms: FeedbackFormRow[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [intro, setIntro] = useState('')
  const [questions, setQuestions] = useState<Question[]>([
    {
      prompt: 'How has your experience at The Worx been this quarter?',
      type: 'rating',
    },
    { prompt: 'What could we do better?', type: 'text' },
  ])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const updateQuestion = (i: number, patch: Partial<Question>) => {
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <section className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
        <h2 className="font-heading text-lg">New feedback form</h2>
        <div>
          <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
            Title
          </label>
          <Input
            placeholder="Q3 2026 member feedback"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-neutral-500 mb-1 block">
            Intro (optional)
          </label>
          <Textarea
            rows={2}
            placeholder="A short note shown at the top of the form and in the email"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            maxLength={2000}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Questions
          </p>
          {questions.map((q, i) => (
            <div key={i} className="flex items-start gap-2">
              <Input
                value={q.prompt}
                onChange={(e) => updateQuestion(i, { prompt: e.target.value })}
                placeholder={`Question ${i + 1}`}
                maxLength={500}
              />
              <select
                value={q.type}
                onChange={(e) =>
                  updateQuestion(i, {
                    type: e.target.value as Question['type'],
                  })
                }
                className="h-9 rounded-md border border-neutral-300 px-2 text-sm bg-white"
              >
                <option value="text">Free text</option>
                <option value="rating">Rating 1–5</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  setQuestions((qs) => qs.filter((_, j) => j !== i))
                }
                className="p-2 text-neutral-400 hover:text-red-700"
                aria-label="Remove question"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setQuestions((qs) => [...qs, { prompt: '', type: 'text' }])
            }
            className="text-xs font-medium text-turquoise-700 hover:text-turquoise-900"
          >
            + Add question
          </button>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button
          type="button"
          disabled={
            isPending ||
            title.trim().length === 0 ||
            questions.filter((q) => q.prompt.trim()).length === 0
          }
          onClick={() => {
            setError(null)
            startTransition(async () => {
              const r = await adminCreateFeedbackForm({
                title: title.trim(),
                intro,
                questions: questions.filter((q) => q.prompt.trim()),
              })
              if (!r.ok) {
                setError(r.error)
                return
              }
              setTitle('')
              setIntro('')
              router.refresh()
            })
          }}
        >
          <Plus size={15} className="mr-1" />
          Create form
        </Button>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="font-heading text-lg">Forms</h2>
        </div>
        {forms.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">
            No feedback forms yet. Create the quarterly one on the left, then
            email it to the whole membership with one click.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {forms.map((f) => (
              <li key={f.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      {f.title}
                      {!f.isOpen && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-neutral-200 text-neutral-700">
                          Closed
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {f.responseCount} response
                      {f.responseCount === 1 ? '' : 's'}
                      {f.sentAt
                        ? ` · emailed ${fmtAstDate(f.sentAt)}`
                        : ' · not emailed yet'}
                      {` · created ${fmtAstDate(f.createdAt)}`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a
                      href={`/admin/feedback/${f.id}`}
                      className="px-2 py-1 text-xs font-medium border border-neutral-300 rounded hover:bg-neutral-50"
                    >
                      Responses
                    </a>
                    {f.isOpen && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setNotice(null)
                          setError(null)
                          startTransition(async () => {
                            const r = await adminSendFeedbackForm({
                              formId: f.id,
                            })
                            if (!r.ok) {
                              setError(r.error)
                              return
                            }
                            setNotice(
                              `Emailed to ${r.sent} member${r.sent === 1 ? '' : 's'}${r.skipped > 0 ? ` (${r.skipped} skipped)` : ''}`
                            )
                            router.refresh()
                          })
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-darkBlue-900 text-white rounded hover:bg-darkBlue-800 disabled:opacity-50"
                      >
                        <Send size={12} />
                        Email to members
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await adminCloseFeedbackForm({
                            formId: f.id,
                            open: !f.isOpen,
                          })
                          if (!r.ok) setError(r.error)
                          else router.refresh()
                        })
                      }
                      className="px-2 py-1 text-xs font-medium text-neutral-600 rounded hover:bg-neutral-100"
                    >
                      {f.isOpen ? 'Close' : 'Reopen'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {(notice || error) && (
          <p
            className={
              notice
                ? 'px-6 pb-4 text-sm text-green-800'
                : 'px-6 pb-4 text-sm text-red-700'
            }
          >
            {notice ?? error}
          </p>
        )}
      </section>
    </div>
  )
}
