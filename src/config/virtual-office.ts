// Virtual Office product config + non-binding agreement copy.
// Members accept the current version at signup; the version + timestamp
// is stored on virtual_office_subscriptions. Bump VO_AGREEMENT_VERSION to
// force existing members to re-accept on their next sign-in (we'd add a
// gate similar to needsOnboarding for that — not built yet).

export const VO_AGREEMENT_VERSION = '2026-05'

export const VO_REGISTERED_ADDRESS =
  '1 Luis Street, Port of Spain, Trinidad and Tobago'

// Compliance documents collected at Virtual Office signup. All three are
// required before payment. The `kind` strings line up with the
// virtual_office_documents.kind CHECK constraint.
export const VO_DOCUMENT_KINDS = [
  'government_id',
  'business_registration',
  'proof_of_address',
] as const

export type VODocumentKind = (typeof VO_DOCUMENT_KINDS)[number]

export interface VODocumentSpec {
  kind: VODocumentKind
  label: string
  description: string
}

export const VO_DOCUMENT_SPECS: VODocumentSpec[] = [
  {
    kind: 'government_id',
    label: 'Government-issued ID',
    description:
      "National ID, driver's permit, or passport. We need to identify the person signing on behalf of the business.",
  },
  {
    kind: 'business_registration',
    label: 'Business registration',
    description:
      'Certificate of Incorporation or Business Name Registration. If you trade under your own name, upload your ID again here.',
  },
  {
    kind: 'proof_of_address',
    label: 'Proof of director address',
    description:
      'Utility bill or bank statement from the last three months, in the name of the person uploading the ID above.',
  },
]

export const VO_STORAGE_BUCKET = 'virtual-office-docs'
export const VO_DOC_MAX_BYTES = 8 * 1024 * 1024 // 8 MB

export const VO_DOC_ACCEPT_MIME = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/pdf',
]

export const VO_AGREEMENT_INTRO =
  'This is a non-binding statement of intent. It confirms that you intend to use The Worx as a registered address for the business below, subject to the membership terms.'

export interface VOAgreementSection {
  title: string
  body: string[]
}

export const VO_AGREEMENT_SECTIONS: VOAgreementSection[] = [
  {
    title: '1. Use of address',
    body: [
      `You are permitted to use The Worx's address — ${VO_REGISTERED_ADDRESS} — as a registered business address while your Virtual Office membership is active.`,
      'This permission is non-binding and revocable. The Worx may withdraw permission with 30 days written notice for any reason, including non-payment or misuse.',
      'The use of this address is limited to standard business correspondence. It may not be used in connection with any activity that is illegal, fraudulent, or that creates reputational risk for The Worx.',
    ],
  },
  {
    title: '2. Mail handling',
    body: [
      'We accept mail addressed to your registered business at our reception during business hours.',
      'For each piece of mail received, we will photograph and log it within one business day, then notify you by email and in your dashboard.',
      'You may collect mail in person, request forwarding (for an additional fee, agreed in advance), or instruct us to discard it.',
      'Mail not collected within 30 days of receipt may be discarded at our discretion. We are not responsible for mail loss, damage, or delivery delays caused by the postal service or couriers.',
    ],
  },
  {
    title: '3. Limitations',
    body: [
      'The Virtual Office plan does not include physical workspace access, meeting room time, or printing services.',
      'It does not constitute a lease, tenancy, or any form of real property interest.',
      'We will not accept, hold, or sign for shipments that are unreasonably large or that require special handling, without prior written agreement.',
    ],
  },
  {
    title: '4. Termination',
    body: [
      'You may cancel your Virtual Office membership at any time by emailing team@theworx.io. Cancellation takes effect at the end of the current billing period.',
      'Upon cancellation you must update your registered business address with all relevant authorities and third parties. The Worx is not responsible for mail received after cancellation.',
      'Termination of this Virtual Office membership does not affect any other membership or service you hold with The Worx.',
    ],
  },
]
