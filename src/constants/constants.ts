import {
  AiOutlineBuild,
  AiOutlineBulb,
  AiOutlineCalendar,
  AiOutlineDesktop,
  AiOutlinePhone,
  AiOutlineTeam,
} from 'react-icons/ai'

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
    id: 'workstations',
    name: 'Work Stations',
    description:
      "Whether you're casually dropping by or need your own space every day, we've got you covered.",
    theme: 'turquoise',
    items: [
      {
        id: 'dedicated-desks',
        name: 'Dedicated Desks',
        description: 'Your very own desk, every time you come into The Worx.',
        qty: 12,
        qtyUnit: { singular: 'desk', plural: 'desks' },
        icon: AiOutlineDesktop,
      },
      {
        id: 'hot-desks',
        name: 'Hot Desks',
        description:
          'Casual seating for drop ins, daily passes, or multi-day passes.',
        qty: 18,
        qtyUnit: { singular: 'seat', plural: 'seats' },
        icon: AiOutlineDesktop,
      },
    ],
  },
  {
    id: 'offices',
    name: 'Private Offices',
    description:
      'Startup or small company looking for your own physical space? Join us at The Worx!',
    theme: 'lime',
    items: [
      {
        id: 'six-person-office',
        name: 'Offices',
        description: 'Private office with a 6-person capacity.',
        qty: 2,
        qtyUnit: { singular: 'office', plural: 'offices' },
        icon: AiOutlineBuild,
      },
    ],
  },
  {
    id: 'meeting-spaces',
    name: 'Meeting Spaces',
    description:
      'Spaces for quick phone calls, small meetings, conferences, and small events.',
    theme: 'lime',
    items: [
      {
        id: 'phone-booth',
        name: 'Phone Booths',
        description:
          'Single person sound-proof phone booths for quick meetings and calls.',
        qty: 4,
        qtyUnit: { singular: 'booth', plural: 'booths' },
        icon: AiOutlinePhone,
      },
      {
        id: 'four-person-meeting-room',
        name: 'Meeting Rooms',
        description:
          'Private meeting rooms for small team meetings and client calls, seating up to 4 people.',
        qty: 2,
        qtyUnit: { singular: 'room', plural: 'rooms' },
        icon: AiOutlineTeam,
      },
      {
        id: 'conference-room',
        name: 'Conference Room',
        description:
          'A large conference room capable of holding up to 20 people. Available for conferences, seminars, events, and more.',
        qty: 1,
        qtyUnit: { singular: 'room', plural: 'rooms' },
        icon: AiOutlineTeam,
      },
    ],
  },
  {
    id: 'collaboration-nooks',
    name: 'Collaboration Nooks',
    description:
      'Casual seating areas for brainstorming, collaboration, or just taking a break.',
    theme: 'darkOrange',
    items: [
      {
        id: 'collab-nooks',
        name: 'Collab Nooks',
        description:
          'Casual seating areas with whiteboards and monitors for brainstorming and collaboration.',
        icon: AiOutlineBulb,
      },
    ],
  },
  {
    id: 'event-space',
    name: 'Events',
    description:
      'Co-branded events on the coworking floor after 5pm or on our 3rd-floor rooftop. We partner with you on programming and promotion.',
    theme: 'orange',
    items: [
      {
        id: 'coworking-after-hours',
        name: 'Coworking Floor — After 5pm',
        description:
          'The main coworking floor cleared and reconfigured for your event after hours. Up to 50 people.',
        icon: AiOutlineCalendar,
      },
      {
        id: 'rooftop-event-space',
        name: 'Rooftop — 3rd Floor',
        description:
          'Open-air rooftop for evening events, launches, mixers. Up to 100 people.',
        icon: AiOutlineCalendar,
      },
    ],
  },
]

export const PLANS = [
  {
    id: 'hot-desk-monthly',
    name: 'Hot Desk - Monthly',
    description: 'Access to any available hot desk during business hours.',
    price: 1250,
    features: [
      'Access to any available hot desk during business hours',
      'High-speed Wi-Fi',
      'Access to common areas',
      'Printing and scanning services',
      'Meeting room credits',
    ],
  },
  {
    id: 'dedicated-desk-monthly',
    name: 'Dedicated Desk - Monthly',
    description: 'Your own dedicated desk in a shared workspace.',
    price: 2000,
    features: [
      'Your own dedicated desk in a shared workspace',
      'High-speed Wi-Fi',
      'Access to common areas',
      'Printing and scanning services',
      'Meeting room credits',
    ],
  },
  {
    id: 'private-office-monthly',
    name: 'Private Office - Monthly',
    description: 'A private office space for your team (up to 6 people).',
    price: 7500,
    features: [
      'A private office space for your team (up to 6 people)',
      'High-speed Wi-Fi',
      'Access to common areas',
      'Printing and scanning services',
      'Meeting room credits',
    ],
  },
  {
    id: 'virtual-office-monthly',
    name: 'Virtual Office - Monthly',
    description: 'Professional business address and mail handling services.',
    price: 250,
    features: ['Professional business address', 'Mail handling and forwarding'],
  },
]

export const PASSES = [
  {
    id: 'day-pass',
    name: 'Day Pass',
    description: 'One-day access to a hot desk during business hours.',
    price: 100,
    features: [
      'One-day access to a hot desk during business hours',
      'High-speed Wi-Fi',
      'Access to common areas',
      'Printing and scanning services',
    ],
  },
  {
    id: 'five-day-pass',
    name: '5 Day Pass',
    description: 'Five-day access to a hot desk during business hours.',
    price: 450,
    features: [
      'Five-day access to a hot desk during business hours',
      'High-speed Wi-Fi',
      'Access to common areas',
      'Printing and scanning services',
    ],
  },
  {
    id: 'ten-day-pass',
    name: '10 Day Pass',
    description: 'Ten-day access to a hot desk during business hours.',
    price: 800,
    features: [
      'Ten-day access to a hot desk during business hours',
      'High-speed Wi-Fi',
      'Access to common areas',
      'Printing and scanning services',
    ],
  },
]

export const BOOKINGS = [
  {
    id: 'meeting-room-1-hour',
    name: 'Meeting Room - 1 Hour',
    description: 'Book a meeting room for one hour.',
    price: 200,
    features: [
      'Book a meeting room for one hour',
      'Includes seating for up to 4 people',
      'Access to presentation equipment',
      'High-speed Wi-Fi',
    ],
  },
  {
    id: 'conference-room-1-hour',
    name: 'Conference Room - 1 Hour',
    description: 'Book the conference room for one hour.',
    price: 450,
    features: [
      'Book the conference room for one hour',
      'Includes seating for up to 20 people',
      'Access to presentation equipment and AV system',
      'High-speed Wi-Fi',
    ],
  },
  {
    id: 'event-space',
    name: 'Event Space',
    description:
      'Get in touch to book our event space for your next meetup, workshop, or community event.',
    features: [
      'Book the event space on evenings and weekends',
      'Includes seating and tables',
      'Access to presentation equipment and AV system',
      'High-speed Wi-Fi',
    ],
  },
]
