// Centralized T&Cs content + version.
// Bump CURRENT_TERMS_VERSION to force every member to re-accept on next sign-in.

export const CURRENT_TERMS_VERSION = '2026-05-18'
export const CURRENT_TERMS_LAST_UPDATED = '18 May 2026'

export interface TermsSection {
  number: string
  title: string
  body: string[]
}

export const TERMS_INTRO = `1 Luis Street, Port of Spain, Trinidad and Tobago

Last updated: ${CURRENT_TERMS_LAST_UPDATED}`

export const TERMS_SECTIONS: TermsSection[] = [
  {
    number: '1',
    title: 'Membership',
    body: [
      '1.1 Eligibility. Membership is open to individuals and companies. All members must be at least 18 years of age.',
      '1.2 Registration. All members must complete a registration form via our member platform, provide accurate personal and billing information, and agree to these Terms and Conditions before accessing the space.',
      "1.3 Membership Plans. The Worx offers a range of membership plans including hot desks, dedicated desks, private offices, and meeting room access. Details of each plan, including fees, inclusions, and access hours, are provided on our website and at the front desk. The Worx reserves the right to modify plan offerings, pricing, and inclusions with 30 days' written notice to affected members.",
      '1.4 Membership is personal to the named individual or company. Memberships may not be transferred, shared, or resold without written approval from The Worx.',
    ],
  },
  {
    number: '2',
    title: 'Payment',
    body: [
      '2.1 Fees. Membership fees are payable monthly in advance on the date specified in your membership agreement. Payment must be made via the methods accepted by The Worx (bank transfer, online payment, or as otherwise agreed).',
      '2.2 Late Payment. If payment is not received within 7 days of the due date, The Worx may suspend access to the space. If payment remains outstanding for more than 14 days, The Worx may terminate the membership and pursue any amounts owed.',
      '2.3 Refunds. Membership fees are non-refundable. If The Worx is unable to provide access to the space for reasons within its control for a continuous period exceeding 5 business days, a pro-rata credit will be applied to the following month.',
      "2.4 Price Changes. The Worx may adjust membership fees with 30 days' written notice. Members who do not accept the new pricing may cancel their membership effective at the end of the current billing period.",
      '2.5 Add-ons and Overages. Meeting room bookings, event space usage, printing, and other services beyond your plan inclusions will be billed separately at the rates published on our website or at the front desk.',
    ],
  },
  {
    number: '3',
    title: 'Access and Use of Space',
    body: [
      '3.1 Access Hours. Members will have access to the space during the hours specified in their membership plan. Standard operating hours are Monday to Friday, 9:00 AM to 5:00 PM. The Worx is closed on Saturdays, Sundays, and public holidays unless otherwise announced. After-hours access is available to eligible members and is subject to the building security requirements outlined in the House Rules.',
      '3.2 The Worx operates within a shared building. Members must comply with both The Worx House Rules and the building management rules at all times. A copy of the House Rules is provided at sign-up and is available at the front desk.',
      '3.3 Hot Desk members must vacate their desk at the end of each day. Personal items left overnight on hot desks may be removed.',
      '3.4 Dedicated Desk and Private Office members may keep personal items at their assigned station but must maintain a clean and professional workspace.',
      '3.5 Meeting rooms and phone booths must be booked in advance through our member platform. Walk-in use is permitted only if the room is unbooked. Members must vacate promptly at the end of their booking.',
      '3.6 The Worx reserves the right to reassign desks, offices, or meeting rooms with reasonable notice where necessary for operational reasons.',
    ],
  },
  {
    number: '4',
    title: 'Conduct',
    body: [
      '4.1 Members, their guests, and their employees must conduct themselves professionally at all times and treat other members, staff, and building occupants with respect.',
      '4.2 The following are strictly prohibited: harassment, intimidation, discrimination, threatening behaviour, illegal activity, excessive noise in the open workspace, and any conduct that disrupts the working environment or damages the reputation of The Worx or the building.',
      '4.3 The Worx reserves the right to immediately remove any person from the space whose behaviour violates these terms or the House Rules, without refund.',
    ],
  },
  {
    number: '5',
    title: 'Guests and Visitors',
    body: [
      '5.1 Members may bring guests to the space for short visits (up to one hour). All guests must check in at the front desk upon arrival.',
      '5.2 Guests staying longer than one hour must purchase a day pass or be registered as a member.',
      '5.3 Members are fully responsible for the conduct and actions of their guests while on the premises.',
      '5.4 Guests are not permitted in restricted areas of the building.',
    ],
  },
  {
    number: '6',
    title: 'Facilities and Equipment',
    body: [
      '6.1 Members may use the facilities, furniture, and equipment provided by The Worx in accordance with their membership plan.',
      '6.2 Members must treat all equipment, furniture, and facilities with care. Any damage caused by a member or their guests must be reported immediately and may be charged to the member at the cost of repair or replacement.',
      '6.3 The Worx provides Wi-Fi and internet access for professional use. Members must not use the network for illegal activity, excessive bandwidth consumption that degrades service for other members, or any activity that compromises network security.',
      '6.4 Printing, scanning, and copying facilities are available subject to fair use limits as specified in your membership plan.',
    ],
  },
  {
    number: '7',
    title: 'Security and Personal Property',
    body: [
      '7.1 Members may be issued access credentials (cards, codes, or keys). These are personal and must not be shared, duplicated, or transferred.',
      '7.2 Lost or stolen access credentials must be reported to the front desk immediately. Replacement fees may apply.',
      '7.3 The Worx is not responsible for loss, theft, or damage to personal belongings, equipment, or data. Members are advised to secure valuables and not leave personal items unattended.',
      '7.4 The Worx may install and operate CCTV in common areas for security purposes.',
    ],
  },
  {
    number: '8',
    title: 'Confidentiality and Privacy',
    body: [
      "8.1 Members must respect the confidentiality of other members' business information, conversations, and activities.",
      '8.2 Photography, filming, or recording in the space is permitted only with the consent of any individuals captured and in compliance with the building rules regarding shared areas.',
      '8.3 The Worx collects and processes personal information in accordance with the Data Protection Act of Trinidad and Tobago. Member information will not be shared with third parties except as required by law or for the operation of the space (e.g., billing, access management).',
    ],
  },
  {
    number: '9',
    title: 'Health and Safety',
    body: [
      '9.1 Members must comply with all applicable health and safety requirements, including fire safety procedures.',
      '9.2 Members must familiarize themselves with emergency exits, fire extinguisher locations, and evacuation procedures. These are displayed in the space and reviewed during onboarding.',
      '9.3 Members must immediately report any hazard, injury, or safety concern to the front desk.',
      '9.4 Members with specific medical conditions that may require emergency attention are encouraged to inform the front desk confidentially.',
    ],
  },
  {
    number: '10',
    title: 'Intellectual Property',
    body: [
      '10.1 Membership at The Worx does not create any partnership, joint venture, or employment relationship between members, or between members and The Worx.',
      '10.2 Each member retains full ownership of their own intellectual property. The Worx claims no rights over any work produced by members while using the space.',
      '10.3 Members may not use The Worx name, logo, or branding in any marketing or communications without prior written approval.',
    ],
  },
  {
    number: '11',
    title: 'Events',
    body: [
      '11.1 Members wishing to host events at The Worx must obtain prior approval from The Worx team.',
      '11.2 After-hours events require additional approval from building management.',
      '11.3 Members hosting events are responsible for event setup, teardown, cleanup, guest conduct, and compliance with all applicable rules.',
      '11.4 The Worx may charge event fees for use of the space, equipment, or additional services. These will be agreed in advance.',
    ],
  },
  {
    number: '12',
    title: 'Cancellation and Termination',
    body: [
      '12.1 Cancellation by Member. Members may cancel their membership by providing written notice (email to team@theworx.io) at least 14 days before the next billing date. The membership will remain active until the end of the current paid period.',
      '12.2 Cancellation by The Worx. The Worx may terminate a membership immediately and without refund for serious or repeated breaches of these Terms and Conditions or the House Rules, including but not limited to: non-payment, harassment, illegal activity, damage to property, or conduct that endangers the safety of others.',
      "12.3 The Worx may also terminate a membership with 30 days' written notice for any reason, in which case a pro-rata refund of prepaid fees will be provided.",
      '12.4 Upon termination, the member must return any access credentials, remove all personal belongings within 48 hours, and settle any outstanding balance.',
      '12.5 Personal belongings not collected within 14 days of termination may be disposed of by The Worx.',
    ],
  },
  {
    number: '13',
    title: 'Liability',
    body: [
      '13.1 The Worx is not liable for any loss, damage, or injury arising from the use of the space, facilities, or equipment, except where caused by the negligence of The Worx.',
      '13.2 The Worx is not liable for any interruption of services (including internet, power, or air conditioning) caused by factors beyond its reasonable control.',
      "13.3 Members agree to indemnify and hold harmless The Worx, its directors, employees, and agents from any claims, losses, damages, or expenses arising from the member's use of the space, breach of these terms, or the actions of the member's guests or employees.",
      '13.4 The total liability of The Worx to any member in any 12-month period shall not exceed the total fees paid by that member in that period.',
    ],
  },
  {
    number: '14',
    title: 'Amendments',
    body: [
      '14.1 The Worx reserves the right to amend these Terms and Conditions at any time. Members will be notified of material changes at least 14 days in advance via email.',
      '14.2 Continued use of the space after notification constitutes acceptance of the amended terms. Members who do not accept the changes may cancel their membership in accordance with Section 12.1.',
    ],
  },
  {
    number: '15',
    title: 'Governing Law and Disputes',
    body: [
      '15.1 These Terms and Conditions are governed by and construed in accordance with the laws of the Republic of Trinidad and Tobago.',
      '15.2 Any dispute arising from these terms will first be addressed through good faith negotiation between the parties. If unresolved within 30 days, either party may pursue resolution through the courts of Trinidad and Tobago.',
    ],
  },
]

export const TERMS_ACKNOWLEDGEMENT =
  'By completing registration and accessing The Worx, I confirm that I have read, understood, and agree to abide by these Terms and Conditions and the House Rules.'
