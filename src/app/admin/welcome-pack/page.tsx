import { createAdminClient } from '@/utils/supabase/admin'
import WelcomePackManager, {
  type WelcomePackFileRow,
} from '@/components/admin/welcome-pack-manager'

export const dynamic = 'force-dynamic'
// Sending to every member runs at ~4 emails/sec — give the action room.
export const maxDuration = 300

export const metadata = {
  title: 'Welcome pack — Admin',
}

async function loadFiles(): Promise<WelcomePackFileRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('welcome_pack_files')
    .select('id, label, mime_type, size_bytes, created_at')
    .order('created_at', { ascending: true })
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: r.id as string,
    label: r.label as string,
    mimeType: (r.mime_type as string | null) ?? null,
    sizeBytes: (r.size_bytes as number | null) ?? null,
    createdAt: r.created_at as string,
  }))
}

export default async function AdminWelcomePackPage() {
  const files = await loadFiles()

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Welcome pack</h1>
        <p className="text-neutral-600 max-w-2xl">
          Upload the documents, pictures, and videos every new member should
          get, then email the pack to one member or the whole community.
        </p>
      </div>
      <WelcomePackManager files={files} />
    </div>
  )
}
