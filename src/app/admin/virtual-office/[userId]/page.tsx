import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Mail as MailIcon } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { fmtAstDateTime } from '@/lib/time/ast'
import LogMailForm from '@/components/admin/log-mail-form'
import AdminMailStatusActions from '@/components/admin/admin-mail-status-actions'
import VoDocumentReviewer from '@/components/admin/vo-document-reviewer'
import VoExtraDocuments, {
  type ExtraDocRow,
} from '@/components/virtual-office/extra-documents'
import {
  VO_DOCUMENT_SPECS,
  VO_REGISTERED_ADDRESS,
  type VODocumentKind,
} from '@/config/virtual-office'
import {
  loadLatestDocsByKind,
  loadExtraDocs,
  signedUrlFor,
  type VoDocumentRow,
} from '@/lib/virtual-office/documents'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ userId: string }>
}

interface VORow {
  business_name: string
  intended_use: string | null
  forwarding_email: string | null
  agreement_version: string
  agreement_accepted_at: string
  is_active: boolean
  created_at: string
  profiles:
    | { full_name: string | null; email: string }
    | { full_name: string | null; email: string }[]
    | null
}

interface MailRow {
  id: string
  received_at: string
  sender: string | null
  label: string | null
  notes: string | null
  photo_url: string | null
  status: string
  notified_at: string | null
}

async function loadVO(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('virtual_office_subscriptions')
    .select(
      'business_name, intended_use, forwarding_email, agreement_version, agreement_accepted_at, is_active, created_at, profiles!virtual_office_subscriptions_user_id_fkey(full_name, email)'
    )
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  const r = data as unknown as VORow
  const profile = Array.isArray(r.profiles)
    ? (r.profiles[0] ?? null)
    : r.profiles
  return { ...r, profile }
}

async function loadMail(userId: string): Promise<MailRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('virtual_office_mail')
    .select(
      'id, received_at, sender, label, notes, photo_url, status, notified_at'
    )
    .eq('user_id', userId)
    .order('received_at', { ascending: false })
    .limit(200)
  return (data ?? []) as unknown as MailRow[]
}

const formatDate = fmtAstDateTime

async function loadDocsWithUrls(userId: string): Promise<
  Array<{
    kind: VODocumentKind
    doc: VoDocumentRow | null
    signedUrl: string | null
  }>
> {
  const admin = createAdminClient()
  const latest = await loadLatestDocsByKind(admin, userId)
  return await Promise.all(
    VO_DOCUMENT_SPECS.map(async (spec) => {
      const doc = latest.get(spec.kind) ?? null
      const signedUrl = doc ? await signedUrlFor(admin, doc.storage_path) : null
      return { kind: spec.kind, doc, signedUrl }
    })
  )
}

async function loadExtraDocsWithUrls(userId: string): Promise<ExtraDocRow[]> {
  const admin = createAdminClient()
  const extras = await loadExtraDocs(admin, userId)
  return await Promise.all(
    extras.map(async (d) => ({
      id: d.id,
      label: d.label,
      status: d.status,
      original_filename: d.original_filename,
      uploaded_by_admin: d.uploaded_by_admin,
      created_at: d.created_at,
      signed_url: await signedUrlFor(admin, d.storage_path),
    }))
  )
}

export default async function AdminVODetailPage({ params }: PageProps) {
  const { userId } = await params
  const [vo, mail, docs, extras] = await Promise.all([
    loadVO(userId),
    loadMail(userId),
    loadDocsWithUrls(userId),
    loadExtraDocsWithUrls(userId),
  ])
  if (!vo) notFound()

  return (
    <div className="space-y-6">
      <Link
        href="/admin/virtual-office"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <ChevronLeft size={16} />
        All Virtual Office subscriptions
      </Link>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl mb-1">{vo.business_name}</h1>
            <p className="text-sm text-neutral-600">
              {vo.profile?.full_name ?? ''} · {vo.profile?.email}
            </p>
          </div>
          <span
            className={
              vo.is_active
                ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-turquoise-100 text-turquoise-800'
                : 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700'
            }
          >
            {vo.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
              Notification email
            </dt>
            <dd>{vo.forwarding_email ?? vo.profile?.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
              Agreement
            </dt>
            <dd>
              v{vo.agreement_version} · accepted{' '}
              {formatDate(vo.agreement_accepted_at)}
            </dd>
          </div>
          {vo.intended_use && (
            <div className="md:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Intended use
              </dt>
              <dd className="whitespace-pre-line">{vo.intended_use}</dd>
            </div>
          )}
          <div className="md:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
              Registered address
            </dt>
            <dd>{VO_REGISTERED_ADDRESS}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <h2 className="font-heading text-lg mb-1">Compliance documents</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Files uploaded at signup. View, approve, or request changes.
        </p>
        <div className="space-y-5">
          {docs.map(({ kind, doc, signedUrl }) => {
            const spec = VO_DOCUMENT_SPECS.find((s) => s.kind === kind)!
            return (
              <div
                key={kind}
                className="border border-neutral-200 rounded-md p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{spec.label}</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {doc?.original_filename ?? 'Not uploaded yet'}
                      {doc && ` · uploaded ${formatDate(doc.created_at)}`}
                    </p>
                  </div>
                </div>
                {doc ? (
                  <VoDocumentReviewer
                    documentId={doc.id}
                    currentStatus={doc.status}
                    signedUrl={signedUrl}
                    reviewNote={doc.review_note}
                  />
                ) : (
                  <p className="text-xs text-neutral-500">
                    Member hasn&apos;t uploaded this document yet.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <h2 className="font-heading text-lg mb-1">Additional documents</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Anything beyond the three required compliance files — supplementary
          letters, updated registrations, etc. You can add these on behalf of
          the member.
        </p>
        <VoExtraDocuments
          initial={extras}
          targetUserId={userId}
          variant="admin"
        />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <h2 className="font-heading text-lg mb-4">Log new mail item</h2>
        <LogMailForm userId={userId} />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="font-heading text-lg">Mail history</h2>
          <p className="text-xs text-neutral-500 mt-1">
            {mail.length} item{mail.length === 1 ? '' : 's'}
          </p>
        </div>
        {mail.length === 0 ? (
          <div className="p-8 text-center">
            <MailIcon size={28} className="text-neutral-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">No mail logged yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {mail.map((m) => (
              <li key={m.id} className="p-4 md:p-5">
                <div className="flex items-start gap-4">
                  {m.photo_url && (
                    <a
                      href={m.photo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.photo_url}
                        alt={m.label ?? 'Mail'}
                        className="w-20 h-20 object-cover rounded border border-neutral-200"
                      />
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {m.label || m.sender || 'Mail item'}
                    </p>
                    {m.sender && m.label && (
                      <p className="text-xs text-neutral-500">
                        From: {m.sender}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 mb-2">
                      Logged {formatDate(m.received_at)}
                      {m.notified_at && ' · member notified'}
                    </p>
                    {m.notes && (
                      <p className="text-sm text-neutral-700 mb-2 whitespace-pre-line">
                        {m.notes}
                      </p>
                    )}
                    <AdminMailStatusActions
                      mailId={m.id}
                      currentStatus={m.status}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
