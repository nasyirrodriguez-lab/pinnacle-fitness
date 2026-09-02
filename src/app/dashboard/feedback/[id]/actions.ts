'use server'

import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

const submitSchema = z.object({
  formId: z.string().uuid(),
  answers: z
    .array(z.union([z.string().max(5000), z.number().min(1).max(5), z.null()]))
    .max(20),
})

export type SubmitFeedbackResult = { ok: true } | { ok: false; error: string }

export async function submitFeedback(
  input: z.infer<typeof submitSchema>
): Promise<SubmitFeedbackResult> {
  let data
  try {
    data = submitSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid submission' }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in first' }

  const admin = createAdminClient()
  const { data: form } = await admin
    .from('feedback_forms')
    .select('is_open')
    .eq('id', data.formId)
    .maybeSingle()
  if (!form || !(form as { is_open: boolean }).is_open) {
    return { ok: false, error: 'This feedback form is closed' }
  }

  const { error } = await admin.from('feedback_responses').upsert(
    {
      form_id: data.formId,
      user_id: user.id,
      answers: data.answers,
    },
    { onConflict: 'form_id,user_id' }
  )
  if (error) {
    console.error('[feedback] submit failed:', error)
    return { ok: false, error: 'Could not save your feedback — try again' }
  }
  return { ok: true }
}
