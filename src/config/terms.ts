// The Member Code + membership terms. Bump CURRENT_TERMS_VERSION to make
// every member re-accept on next sign-in.

export const CURRENT_TERMS_VERSION = '2026-09-02'
export const CURRENT_TERMS_LAST_UPDATED = '2 September 2026'

export interface TermsSection {
  number: string
  title: string
  body: string[]
}

export const TERMS_INTRO = `Pinnacle Fitness at The Playground — Sport & Social, 227 Western Main Rd, Port of Spain

Last updated: ${CURRENT_TERMS_LAST_UPDATED}`

export const MEMBER_CODE: string[] = [
  'Respect the equipment. Re-rack, wipe down, report anything broken.',
  'Respect people’s space and time. Share the floor; don’t camp on a station.',
  'No filming other members without asking.',
  'Show up for what you book — or cancel in time so someone else can.',
  'Scan in at the door, every time. Scan out on the way out.',
]

export const TERMS_SECTIONS: TermsSection[] = [
  {
    number: '1',
    title: 'The Member Code',
    body: MEMBER_CODE,
  },
  {
    number: '2',
    title: 'Membership',
    body: [
      '2.1 Membership is by application. Pinnacle is a coached, small-group gym for people who already train; the coaches decide who joins and may keep numbers capped.',
      '2.2 Membership is personal to you. Accounts, sessions and packs can’t be shared or transferred. Guests come in on a guest pass from your own credit and agree to this Code at the door.',
      '2.3 Members must be 18 or older, or have a parent or guardian’s written consent.',
    ],
  },
  {
    number: '3',
    title: 'Plans, packs and sessions',
    body: [
      '3.1 Monthly plans include a set number of PT sessions (or unlimited) and, on some plans, open-gym access. Plans reset on the renewal date; unused sessions do not roll over.',
      '3.2 Packs are valid for 30 days from purchase. Unused sessions expire at the end of that window.',
      '3.3 A PT session is spent when you check in for it. Booking is free; cancelling less than 4 hours before the session, or not showing up, spends the session.',
      '3.4 Open gym is scan-in only, subject to the floor cap, during opening hours. It uses one open-gym visit per day unless your plan includes open gym.',
      '3.5 Prices and inclusions may change with 30 days’ notice. Current prices are on pinnaclefitness.app.',
    ],
  },
  {
    number: '4',
    title: 'Payment',
    body: [
      '4.1 Plans are paid monthly in advance by Wam or cash at the desk. Nothing activates until payment is confirmed.',
      '4.2 If a renewal is not paid, you have a 3-day grace period; after that bookings pause and the iPad will not admit you until the plan is settled.',
      '4.3 Sessions and packs are non-refundable. Where the gym cannot deliver a booked session for reasons within its control, the session is returned to your balance.',
    ],
  },
  {
    number: '5',
    title: 'Safety and conduct',
    body: [
      '5.1 Tell your coach about injuries, conditions or medication that affect how you train. You train at your own risk and are responsible for working within your limits.',
      '5.2 Pinnacle trains outdoors on shared premises. Follow coach instructions, the venue’s rules, and any weather calls the coaches make.',
      '5.3 The coaches may suspend or end a membership for behaviour that breaks the Member Code or puts anyone at risk. Unused paid sessions in that case become account credit.',
    ],
  },
  {
    number: '6',
    title: 'Your data',
    body: [
      '6.1 We keep your name, contact details, check-ins, bookings and payment records to run your membership. Photos you add are for check-in identification only.',
      '6.2 We email and message you about your sessions, renewals and gym news. You can opt out of news any time; session and payment messages come with membership.',
    ],
  },
]

export const TERMS_ACKNOWLEDGEMENT =
  'By accepting, you confirm you have read the Member Code and these terms, and that you train at Pinnacle at your own risk.'
