import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  VISITOR_PHOTOS_BUCKET,
  VISITOR_PHOTO_MAX_BYTES,
  VISITOR_PHOTO_MIME,
} from '@/config/photos'

interface SaveArgs {
  blob: Blob | Buffer
  folder: string
  size: number
  mime: string
}

interface SaveResult {
  ok: true
  path: string
}
interface SaveError {
  ok: false
  error: string
  status: number
}

export async function saveVisitorPhoto(
  args: SaveArgs
): Promise<SaveResult | SaveError> {
  if (args.size === 0) {
    return { ok: false, error: 'Empty file', status: 400 }
  }
  if (args.size > VISITOR_PHOTO_MAX_BYTES) {
    return {
      ok: false,
      error: `Photo too large. Max ${Math.round(VISITOR_PHOTO_MAX_BYTES / (1024 * 1024))} MB.`,
      status: 413,
    }
  }
  if (args.mime !== VISITOR_PHOTO_MIME) {
    return { ok: false, error: 'Unsupported image type.', status: 415 }
  }

  const path = `${args.folder}/${randomUUID()}.jpg`
  const admin = createAdminClient()
  const body =
    args.blob instanceof Buffer
      ? args.blob
      : Buffer.from(await (args.blob as Blob).arrayBuffer())

  const { error } = await admin.storage
    .from(VISITOR_PHOTOS_BUCKET)
    .upload(path, body, {
      contentType: VISITOR_PHOTO_MIME,
      cacheControl: '3600',
      upsert: false,
    })
  if (error) {
    console.error('[saveVisitorPhoto] upload failed:', error)
    return { ok: false, error: 'Upload failed', status: 500 }
  }
  return { ok: true, path }
}

export async function signedVisitorPhotoUrl(
  path: string,
  expiresInSeconds = 60 * 10
): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(VISITOR_PHOTOS_BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  if (error || !data) return null
  return data.signedUrl
}
