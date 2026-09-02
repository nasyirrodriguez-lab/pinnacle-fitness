import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  VO_DOCUMENT_KINDS,
  VO_DOC_ACCEPT_MIME,
  VO_DOC_MAX_BYTES,
  VO_STORAGE_BUCKET,
  type VODocumentKind,
} from '@/config/virtual-office'

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

const EXTRA_KIND = 'other' as const
type AnyVoKind = VODocumentKind | typeof EXTRA_KIND

function isVoKind(s: string): s is AnyVoKind {
  return (
    (VO_DOCUMENT_KINDS as readonly string[]).includes(s) || s === EXTRA_KIND
  )
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const kindRaw = form.get('kind')
  const file = form.get('file')
  const labelRaw = form.get('label')
  const targetUserIdRaw = form.get('targetUserId')

  if (typeof kindRaw !== 'string' || !isVoKind(kindRaw)) {
    return NextResponse.json(
      { error: 'Invalid document kind' },
      { status: 400 }
    )
  }
  const label =
    typeof labelRaw === 'string' && labelRaw.trim()
      ? labelRaw.trim().slice(0, 200)
      : null
  if (kindRaw === EXTRA_KIND && !label) {
    return NextResponse.json(
      { error: 'A label is required for other documents.' },
      { status: 400 }
    )
  }

  // Admin can upload on behalf of a member. Determine target user.
  let targetUserId = user.id
  let isAdminUpload = false
  if (typeof targetUserIdRaw === 'string' && targetUserIdRaw !== user.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile || (profile as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }
    targetUserId = targetUserIdRaw
    isAdminUpload = true
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  }
  if (file.size > VO_DOC_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File too large. Max ${Math.round(VO_DOC_MAX_BYTES / (1024 * 1024))} MB.`,
      },
      { status: 413 }
    )
  }
  if (!VO_DOC_ACCEPT_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use JPG, PNG, HEIC, WEBP, or PDF.' },
      { status: 415 }
    )
  }

  const ext = EXT_BY_MIME[file.type] ?? 'bin'
  const objectName = `${targetUserId}/${kindRaw}-${randomUUID()}.${ext}`

  const admin = createAdminClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await admin.storage
    .from(VO_STORAGE_BUCKET)
    .upload(objectName, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    })
  if (uploadErr) {
    console.error('[vo/docs/upload] storage upload failed:', uploadErr)
    return NextResponse.json(
      { error: 'Upload failed. Please try again.' },
      { status: 500 }
    )
  }

  const { data: row, error: insertErr } = await admin
    .from('virtual_office_documents')
    .insert({
      user_id: targetUserId,
      kind: kindRaw,
      label,
      uploaded_by_admin: isAdminUpload,
      storage_path: objectName,
      original_filename: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
      status: isAdminUpload ? 'approved' : 'pending',
      reviewed_at: isAdminUpload ? new Date().toISOString() : null,
      reviewed_by: isAdminUpload ? user.id : null,
    })
    .select('id, kind, label, status, created_at, original_filename')
    .single()
  if (insertErr || !row) {
    // Compensate: clean up the orphaned object so storage doesn't drift
    // from the DB.
    await admin.storage.from(VO_STORAGE_BUCKET).remove([objectName])
    console.error('[vo/docs/upload] db insert failed:', insertErr)
    return NextResponse.json(
      { error: 'Could not save upload' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, document: row })
}
