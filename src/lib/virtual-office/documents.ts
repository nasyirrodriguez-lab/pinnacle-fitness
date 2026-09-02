import type { SupabaseClient } from '@supabase/supabase-js'
import {
  VO_DOCUMENT_KINDS,
  VO_STORAGE_BUCKET,
  type VODocumentKind,
} from '@/config/virtual-office'

export interface VoDocumentRow {
  id: string
  kind: VODocumentKind | 'other'
  label: string | null
  uploaded_by_admin: boolean
  status: 'pending' | 'approved' | 'rejected'
  storage_path: string
  original_filename: string | null
  mime_type: string | null
  size_bytes: number | null
  review_note: string | null
  reviewed_at: string | null
  created_at: string
}

// Latest document per kind for a user. Older uploads remain in the table
// for audit but aren't shown in the UI. Skips 'other' since each is
// labelled uniquely and there's no "latest per other" meaning.
export async function loadLatestDocsByKind(
  admin: SupabaseClient,
  userId: string
): Promise<Map<VODocumentKind, VoDocumentRow>> {
  const { data } = await admin
    .from('virtual_office_documents')
    .select(
      'id, kind, label, uploaded_by_admin, status, storage_path, original_filename, mime_type, size_bytes, review_note, reviewed_at, created_at'
    )
    .eq('user_id', userId)
    .neq('kind', 'other')
    .order('created_at', { ascending: false })

  const latest = new Map<VODocumentKind, VoDocumentRow>()
  for (const r of (data ?? []) as VoDocumentRow[]) {
    if (r.kind === 'other') continue
    if (!latest.has(r.kind)) latest.set(r.kind, r)
  }
  return latest
}

// All "other" / extra documents for a user, newest first. These are
// shown alongside the three required kinds.
export async function loadExtraDocs(
  admin: SupabaseClient,
  userId: string
): Promise<VoDocumentRow[]> {
  const { data } = await admin
    .from('virtual_office_documents')
    .select(
      'id, kind, label, uploaded_by_admin, status, storage_path, original_filename, mime_type, size_bytes, review_note, reviewed_at, created_at'
    )
    .eq('user_id', userId)
    .eq('kind', 'other')
    .order('created_at', { ascending: false })
  return (data ?? []) as VoDocumentRow[]
}

export function hasAllRequiredDocs(
  latest: Map<VODocumentKind, VoDocumentRow>
): boolean {
  return VO_DOCUMENT_KINDS.every((k) => latest.has(k))
}

// Short-lived signed URL to view a document. Storage bucket is private so
// we can't return a direct URL.
export async function signedUrlFor(
  admin: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 60 * 10
): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(VO_STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data) {
    console.error('[vo/docs/signedUrl] failed:', error)
    return null
  }
  return data.signedUrl
}
