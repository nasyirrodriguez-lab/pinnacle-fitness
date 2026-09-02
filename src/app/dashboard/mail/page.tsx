import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Mail as MailIcon } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createAdminClient } from '@/utils/supabase/admin'
import { fmtAstDateTime } from '@/lib/time/ast'
import MailItemActions from '@/components/virtual-office/mail-item-actions'
import VoExtraDocuments, {
  type ExtraDocRow,
} from '@/components/virtual-office/extra-documents'
import { VO_REGISTERED_ADDRESS } from '@/config/virtual-office'
import { loadExtraDocs, signedUrlFor } from '@/lib/virtual-office/documents'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mail | The Worx',
}

interface MailRow {
  id: string
  received_at: string
  sender: string | null
  label: string | null
  notes: string | null
  photo_url: string | null
  status: string
}

async function loadMail(userId: string): Promise<MailRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('virtual_office_mail')
    .select('id, received_at, sender, label, notes, photo_url, status')
    .eq('user_id', userId)
    .order('received_at', { ascending: false })
    .limit(200)
  return (data ?? []) as unknown as MailRow[]
}

async function loadExtraDocsForMember(userId: string): Promise<ExtraDocRow[]> {
  const admin = createAdminClient()
  const rows = await loadExtraDocs(admin, userId)
  return await Promise.all(
    rows.map(async (d) => ({
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

async function loadVOSubscription(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('virtual_office_subscriptions')
    .select('business_name, is_active')
    .eq('user_id', userId)
    .maybeSingle()
  return data as { business_name: string; is_active: boolean } | null
}

const formatDate = fmtAstDateTime

export default async function MailPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in?next=/dashboard/mail')

  const vo = await loadVOSubscription(user.id)
  if (!vo) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-6 md:p-8">
        <h1 className="font-heading text-2xl mb-3">Mail</h1>
        <p className="text-sm text-neutral-600 mb-4">
          You don&apos;t have a Virtual Office subscription yet.
        </p>
        <Link
          href="/virtual-office"
          className="inline-flex items-center justify-center px-4 py-2 bg-turquoise-500 hover:bg-turquoise-600 text-white text-sm font-medium rounded-md transition"
        >
          Learn about Virtual Office
        </Link>
      </div>
    )
  }

  const [mail, extras] = await Promise.all([
    loadMail(user.id),
    loadExtraDocsForMember(user.id),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl mb-2">Mail</h1>
        <p className="text-sm text-neutral-600">
          Mail addressed to <strong>{vo.business_name}</strong> at{' '}
          {VO_REGISTERED_ADDRESS}
          {!vo.is_active && (
            <span className="ml-2 text-red-700">
              (subscription inactive — email team@theworx.io)
            </span>
          )}
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <h2 className="font-heading text-lg mb-1">Documents</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Additional documents you&apos;d like us to keep on file alongside your
          Virtual Office subscription. We&apos;ll review each one and let you
          know if anything needs to change.
        </p>
        <VoExtraDocuments initial={extras} variant="member" />
      </div>

      {mail.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
          <MailIcon size={32} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-700 mb-1">
            No mail yet
          </p>
          <p className="text-xs text-neutral-500">
            When mail arrives for you, we&apos;ll log it here and email you.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {mail.map((m) => (
            <li
              key={m.id}
              className="bg-white border border-neutral-200 rounded-lg overflow-hidden"
            >
              <div className="md:flex">
                {m.photo_url ? (
                  <a
                    href={m.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="md:w-48 md:shrink-0 bg-neutral-100 aspect-[4/3] md:aspect-auto block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.photo_url}
                      alt={m.label ?? 'Mail item'}
                      className="w-full h-full object-cover"
                    />
                  </a>
                ) : (
                  <div className="md:w-48 md:shrink-0 bg-neutral-50 flex items-center justify-center aspect-[4/3] md:aspect-auto">
                    <MailIcon size={28} className="text-neutral-300" />
                  </div>
                )}
                <div className="flex-1 p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {m.label || m.sender || 'Mail item'}
                      </p>
                      {m.sender && m.label && (
                        <p className="text-xs text-neutral-500 truncate">
                          From: {m.sender}
                        </p>
                      )}
                    </div>
                    <span
                      className={
                        m.status === 'received'
                          ? 'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-turquoise-50 text-turquoise-800'
                          : 'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 capitalize'
                      }
                    >
                      {m.status}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mb-2">
                    Received {formatDate(m.received_at)}
                  </p>
                  {m.notes && (
                    <p className="text-sm text-neutral-700 mb-3 whitespace-pre-line">
                      {m.notes}
                    </p>
                  )}
                  <MailItemActions mailId={m.id} currentStatus={m.status} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
