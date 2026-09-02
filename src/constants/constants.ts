import { AiOutlineTeam, AiOutlineThunderbolt, AiOutlineUser } from 'react-icons/ai'

export const SITE_NAME = 'Pinnacle Fitness'
export const SITE_TAGLINE = 'A members-only coached gym in Port of Spain'

// What Pinnacle offers. Shared by the inquiry form and the marketing
// offerings section — keep ids stable, they're used as form values.
export const SERVICES: Array<{
  id: string
  name: string
  description: string
  theme: string
  items: Array<{
    id: string
    name: string
    description: string
    qty?: number
    qtyUnit?: { singular: string; plural: string }
    icon: React.ComponentType<object>
  }>
}> = [
  {
    id: 'personal-training',
    name: 'Personal Training',
    description:
      'Coached, small-group sessions built around your goals. Book by coach — every hour is a real programme, not a workout you guess at.',
    theme: 'turf',
    items: [
      {
        id: 'pt-nasyir',
        name: 'PT with Nasyir',
        description:
          'Co-founder and head coach. Direct, progressive coaching for real people with real goals.',
        icon: AiOutlineUser,
      },
      {
        id: 'pt-matthew',
        name: 'PT with Matthew',
        description:
          'Co-founder and head coach. Structure and precision — consistency on the right foundation.',
        icon: AiOutlineUser,
      },
    ],
  },
  {
    id: 'open-gym',
    name: 'Open Gym',
    description:
      'Scan in, use the floor. Full weight floor, machines, and the turf — capped so it never gets crowded.',
    theme: 'bronze',
    items: [
      {
        id: 'open-gym-floor',
        name: 'Open Gym',
        description:
          'Members-only floor time during opening hours. The iPad admits you when there is room.',
        qty: 20,
        qtyUnit: { singular: 'person on the floor', plural: 'people on the floor' },
        icon: AiOutlineThunderbolt,
      },
    ],
  },
  {
    id: 'community',
    name: 'Community',
    description:
      'Membership is by application and kept small on purpose, so the coaches know every member by name.',
    theme: 'ice',
    items: [
      {
        id: 'membership',
        name: 'Membership',
        description:
          'Monthly plans and session packs. Apply, meet the coaches at an intro session, then train.',
        icon: AiOutlineTeam,
      },
    ],
  },
]
