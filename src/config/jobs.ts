export interface JobFocusArea {
  number: string
  title: string
  bullets: string[]
}

export interface Job {
  slug: string
  title: string
  shortTitle?: string
  contractType: string
  location: string
  hours: string
  salary?: string
  reportsTo: string
  toolsUsed: string[]
  about: string
  roleSummary: string
  idealCandidate: { trait: string; description: string }[]
  focusAreas: JobFocusArea[]
  whyJoin: string[]
  applyEmail: string
  applyNote: string
  // Open-ended timestamp; absent = open. Set to ISO date when filled.
  closedAt?: string
}

export const JOBS: Job[] = [
  {
    slug: 'coworking-space-manager',
    title: 'Coworking Space Manager',
    shortTitle: 'Space Manager',
    closedAt: '2026-07-31',
    contractType: '12-month contract',
    location: 'Port of Spain, Trinidad & Tobago',
    hours: 'Mon–Fri, 8 AM–5 PM',
    reportsTo: 'Director, The Worx',
    toolsUsed: [
      'Nexudus',
      'WhatsApp Business',
      'Google Workspace',
      'Social media platforms',
    ],
    about:
      'The Worx is a coworking space in the heart of Port of Spain, built for people who want a productive, community-driven place to work. We host members, run events, and create an environment people are genuinely excited to walk into every day.',
    roleSummary:
      'The Coworking Space Manager is the heartbeat of The Worx. You open the doors, keep the space running, sell memberships, coordinate events, and handle every operational detail, so members always have a premium experience.',
    idealCandidate: [
      {
        trait: 'Communicates warmly',
        description: 'Professional, clear, and genuinely people-oriented.',
      },
      {
        trait: 'Stays organised',
        description: 'Tracks details, anticipates needs, and follows through.',
      },
      {
        trait: 'Thinks like an owner',
        description: 'Treats the space with pride and personal accountability.',
      },
      {
        trait: 'Sells naturally',
        description:
          'Sees every conversation as a chance to grow the community.',
      },
      {
        trait: 'Takes initiative',
        description:
          'Sees what needs doing and does it: no waiting to be told.',
      },
    ],
    focusAreas: [
      {
        number: '01',
        title: 'Daily Operations & Space Readiness',
        bullets: [
          'Open and close the space daily: lights, AC, Wi-Fi, security, full walkthrough.',
          'Keep all areas clean and member-ready throughout the day: desks, bathrooms, meeting rooms, common areas.',
          'Monitor and maintain atmosphere: cleanliness, temperature, and noise levels.',
          'Report and follow up on maintenance issues promptly.',
        ],
      },
      {
        number: '02',
        title: 'Member Services & Community',
        bullets: [
          'Greet members and visitors; manage sign-ins and give tours to prospective members.',
          'Onboard new members: access details, Nexudus setup, space orientation, and community intros.',
          'Handle all inbound inquiries across email, WhatsApp, social media, and walk-ins.',
          'Collect and act on member feedback to continuously improve the experience.',
        ],
      },
      {
        number: '03',
        title: 'Sales, Bookings & Revenue',
        bullets: [
          'Actively promote memberships, hot desks, private offices, and meeting rooms.',
          'Follow up on leads and cold inquiries; upsell where it fits.',
          'Manage event space inquiries: respond, quote, confirm, and handle contracts.',
          'Track occupancy and report weekly on sign-ups, cancellations, and pipeline.',
        ],
      },
      {
        number: '04',
        title: 'Facilities & Supplies',
        bullets: [
          'Liaise with the cleaning contractor; maintain standards across the entire space.',
          'Keep the kitchenette and all supply areas fully stocked at all times.',
          'Track inventory across kitchen, bathroom, printer, and stationery supplies.',
          'Maintain an asset register and keep storage areas organised.',
        ],
      },
      {
        number: '05',
        title: 'Events Coordination',
        bullets: [
          'Coordinate logistics with the events team: setup, AV, seating, signage, vendors.',
          'Be the on-site point of contact during events, including evenings and weekends as needed.',
          'Manage teardown and cleanup the same night with the team and cleaning contractor.',
        ],
      },
      {
        number: '06',
        title: 'Communications & Admin',
        bullets: [
          'Liaise with the social media team: share content opportunities, photos, and member stories.',
          'Keep online listings current: Google Business, website, social bios.',
          'Manage The Worx WhatsApp groups and community channels.',
          'Maintain member records in Nexudus, manage petty cash, and provide a brief weekly update to the Director.',
        ],
      },
    ],
    whyJoin: [
      'This role is built for someone who wants real ownership over their work. You’ll run a space that matters to its community, with full trust from the Director to make daily decisions and shape the member experience.',
      'If you’re someone who takes pride in a well-run environment and thrives when given responsibility, this is the role for you.',
    ],
    applyEmail: 'team@theworx.io',
    applyNote: 'Applications are reviewed on a rolling basis.',
  },
]

export function getJob(slug: string): Job | undefined {
  return JOBS.find((j) => j.slug === slug)
}

export function getOpenJobs(): Job[] {
  return JOBS.filter((j) => !j.closedAt)
}
