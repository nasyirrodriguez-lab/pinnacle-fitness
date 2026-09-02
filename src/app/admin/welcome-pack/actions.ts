'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isOwner } from '@/lib/auth/roles'
import { sendBroadcast } from '@/lib/email/broadcast'
import { sendMemberNotification } from '@/lib/notifications/notify'
import { display, eyebrow, paragraph, escapeHtml } from '@/lib/email/layout'

const BUCKET = 'welcome-pack'
const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60

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

// Files (docs, pictures, videos) upload straight from the browser to
// storage via a signed URL — no server body-size limits in the way.
const uploadUrlSchema = z.object({
  filename: z.string().min(1).max(200),
})

export async function createWelcomePackUploadUrl(
  input: z.infer<typeof uploadUrlSchema>
): Promise<
  { ok: true; signedUrl: string; path: string } | { ok: false; error: string }
> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = uploadUrlSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid filename' }
  }

  const safeName = data.filename.replace(/[^A-Za-z0-9._-]+/g, '-')
  const path = `${crypto.randomUUID()}/${safeName}`
  const admin = createAdminClient()
  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path)
  if (error || !signed) {
    console.error('[welcome-pack] signed upload url failed:', error)
    return { ok: false, error: 'Could not start the upload' }
  }
  return { ok: true, signedUrl: signed.signedUrl, path }
}

const registerSchema = z.object({
  path: z.string().min(1).max(400),
  label: z.string().trim().min(1).max(200),
  mimeType: z.string().max(150).optional().nullable(),
  sizeBytes: z.number().int().min(0).optional().nullable(),
})

export async function registerWelcomePackFile(
  input: z.infer<typeof registerSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = registerSchema.parse(input)
  } catch {
    return { ok: false, error: 'Invalid file' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('welcome_pack_files').insert({
    label: data.label,
    storage_path: data.path,
    mime_type: data.mimeType ?? null,
    size_bytes: data.sizeBytes ?? null,
    uploaded_by: auth.adminId,
  })
  if (error) {
    console.error('[welcome-pack] register failed:', error)
    return { ok: false, error: 'Could not save the file' }
  }
  revalidatePath('/admin/welcome-pack')
  return { ok: true }
}

export async function deleteWelcomePackFile(input: {
  fileId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!z.string().uuid().safeParse(input.fileId).success) {
    return { ok: false, error: 'Invalid file' }
  }
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('welcome_pack_files')
    .select('storage_path')
    .eq('id', input.fileId)
    .maybeSingle()
  if (row) {
    await admin.storage
      .from(BUCKET)
      .remove([(row as { storage_path: string }).storage_path])
  }
  const { error } = await admin
    .from('welcome_pack_files')
    .delete()
    .eq('id', input.fileId)
  if (error) return { ok: false, error: 'Could not delete the file' }
  revalidatePath('/admin/welcome-pack')
  return { ok: true }
}

const sendSchema = z.object({
  // Blank = every active member.
  recipientEmail: z
    .string()
    .email('Enter a valid member email, or leave blank for everyone')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  intro: z.string().trim().max(3000).optional(),
})

export type SendWelcomePackResult =
  | { ok: true; sent: number; skipped: number; failed: number }
  | { ok: false; error: string }

export async function sendWelcomePack(
  input: z.infer<typeof sendSchema>
): Promise<SendWelcomePackResult> {
  const auth = await assertAdmin()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = sendSchema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? 'Invalid input')
        : 'Invalid input'
    return { ok: false, error: msg }
  }

  const admin = createAdminClient()
  const { data: files } = await admin
    .from('welcome_pack_files')
    .select('label, storage_path, mime_type')
    .order('created_at', { ascending: true })
  const fileRows =
    (files as
      | { label: string; storage_path: string; mime_type: string | null }[]
      | null) ?? []
  if (fileRows.length === 0) {
    return { ok: false, error: 'Upload at least one file first.' }
  }

  const links: { label: string; url: string }[] = []
  for (const f of fileRows) {
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(f.storage_path, SIGNED_URL_SECONDS)
    if (signed?.signedUrl) links.push({ label: f.label, url: signed.signedUrl })
  }
  if (links.length === 0) {
    return { ok: false, error: 'Could not generate download links' }
  }

  let recipients: { userId: string; email: string; fullName: string | null }[]
  if (data.recipientEmail) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', data.recipientEmail.toLowerCase().trim())
      .maybeSingle()
    if (!profile) return { ok: false, error: 'No member with that email.' }
    const p = profile as { id: string; email: string; full_name: string | null }
    recipients = [{ userId: p.id, email: p.email, fullName: p.full_name }]
  } else {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('archived', false)
      .not('email', 'is', null)
    recipients = (
      (profiles as
        | { id: string; email: string; full_name: string | null }[]
        | null) ?? []
    ).map((p) => ({ userId: p.id, email: p.email, fullName: p.full_name }))
  }
  if (recipients.length === 0) {
    return { ok: false, error: 'No recipients found' }
  }

  const linkList = links
    .map(
      (l) =>
        `<li style="margin:0 0 8px;"><a href="${l.url}" style="color:#0e7490;">${escapeHtml(l.label)}</a></li>`
    )
    .join('')
  const bodyHtml = [
    eyebrow('Welcome pack'),
    display('Welcome to Pinnacle'),
    data.intro?.trim()
      ? paragraph(escapeHtml(data.intro.trim()).replace(/\n/g, '<br/>'))
      : paragraph(
          'Everything you need to get started — house guides, member info, and more. Download links below (valid for 7 days).'
        ),
    `<ul style="padding-left:18px;margin:8px 0 24px;font-size:14px;">${linkList}</ul>`,
    paragraph(
      'Questions? Just reply to this email or catch the team at the front desk.'
    ),
  ].join('')

  const result = await sendBroadcast({
    admin,
    input: {
      subject: 'Your Pinnacle welcome pack',
      bodyMarkdown: '',
      bodyHtml,
      recipients,
      template: `welcome-pack:${Date.now()}`,
    },
  })

  if (recipients.length === 1) {
    await sendMemberNotification(admin, {
      userId: recipients[0].userId,
      title: 'Your welcome pack is in your inbox',
      body: 'We emailed you the Pinnacle welcome pack — download links are valid for 7 days.',
      createdBy: auth.adminId,
    })
  }

  revalidatePath('/admin/welcome-pack')
  return {
    ok: true,
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
  }
}
