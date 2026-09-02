'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isOwner } from '@/lib/auth/roles'
import { sendBroadcast } from '@/lib/email/broadcast'
import { sendMemberNotification } from '@/lib/notifications/notify'
import {
  display,
  eyebrow,
  paragraph,
  ctaButton,
  escapeHtml,
} from '@/lib/email/layout'

async function assertAdmin(): Promise<{ adminId: string } | { error: string }> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || !isOwner((profile as { role?: string }).role)) {
    return { error: 'Owners only' }
  }
  return { adminId: user.id }
}

const questionSchema = z.object({
  prompt: z.string().trim().min(1).max(500),
  type: z.enum(['text', 'rating']),
})

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  intro: z.string().trim().max(2000).optional(),
  questions: z.array(questionSchema).min(1).max(20),
})

export async function adminCreateFeedbackForm(
  input: z.infer<typeof createSchema>
): Promise<{ ok: true; formId: string } | { ok: false; error: string }> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = createSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('feedback_forms')
    .insert({
      title: data.title,
      intro: data.intro?.trim() || null,
      questions: data.questions,
      created_by: auth.adminId,
    })
    .select('id')
    .single()
  if (error || !row) {
    console.error('[feedback] create failed:', error)
    return { ok: false, error: 'Could not create the form' }
  }
  revalidatePath('/admin/feedback')
  return { ok: true, formId: (row as { id: string }).id }
}

export async function adminCloseFeedbackForm(input: {
  formId: string
  open: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!z.string().uuid().safeParse(input.formId).success) {
    return { ok: false, error: 'Invalid form' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('feedback_forms')
    .update({ is_open: input.open })
    .eq('id', input.formId)
  if (error) return { ok: false, error: 'Could not update the form' }
  revalidatePath('/admin/feedback')
  return { ok: true }
}

export type SendFeedbackResult =
  | { ok: true; sent: number; skipped: number; failed: number }
  | { ok: false; error: string }

// Email the form to every active member — the quarterly check-in.
export async function adminSendFeedbackForm(input: {
  formId: string
}): Promise<SendFeedbackResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!z.string().uuid().safeParse(input.formId).success) {
    return { ok: false, error: 'Invalid form' }
  }

  const admin = createAdminClient()
  const { data: formRow } = await admin
    .from('feedback_forms')
    .select('id, title, intro, is_open')
    .eq('id', input.formId)
    .maybeSingle()
  if (!formRow) return { ok: false, error: 'Form not found' }
  const form = formRow as {
    id: string
    title: string
    intro: string | null
    is_open: boolean
  }
  if (!form.is_open) {
    return { ok: false, error: 'Reopen the form before sending it out' }
  }

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .eq('archived', false)
    .not('email', 'is', null)
  const recipients = (
    (profiles as
      | { id: string; email: string; full_name: string | null }[]
      | null) ?? []
  ).map((p) => ({ userId: p.id, email: p.email, fullName: p.full_name }))
  if (recipients.length === 0) return { ok: false, error: 'No members found' }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://theworx.io'
  const formUrl = `${siteUrl}/dashboard/feedback/${form.id}`
  const bodyHtml = [
    eyebrow('We want your feedback'),
    display(form.title),
    paragraph(
      form.intro
        ? escapeHtml(form.intro).replace(/\n/g, '<br/>')
        : 'A few quick questions to help us make The Worx better for you. It takes about two minutes.'
    ),
    ctaButton(formUrl, 'Share your feedback'),
    paragraph('Thanks for helping shape the space — The Worx team.'),
  ].join('')

  const result = await sendBroadcast({
    admin,
    input: {
      subject: form.title,
      bodyMarkdown: '',
      bodyHtml,
      recipients,
      template: `feedback:${form.id}`,
    },
  })

  await sendMemberNotification(admin, {
    userId: null,
    title: form.title,
    body: `We'd love your feedback — fill in the short form at ${formUrl}. It takes about two minutes.`,
    createdBy: auth.adminId,
  })

  await admin
    .from('feedback_forms')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', form.id)

  revalidatePath('/admin/feedback')
  return {
    ok: true,
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
  }
}
