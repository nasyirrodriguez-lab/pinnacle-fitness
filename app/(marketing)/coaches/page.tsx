import type { Coach } from '@/lib/types'

const fallbackCoaches: Coach[] = [
  {
    id: '1',
    name: 'Nasyir Rodriguez',
    photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nasyir',
    specialties: ['Co-Founder / Trainer', 'Strength & Conditioning'],
    bio: 'Co-founder of Pinnacle Fitness and head coach. Nasyir built this gym around one belief — that the right environment changes everything. His coaching is direct, progressive, and built for real people with real goals.',
    order: 1,
  },
  {
    id: '2',
    name: 'Matthew Sirjoo',
    photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Matthew',
    specialties: ['Co-Founder / Trainer', 'Programming'],
    bio: 'Co-founder and head coach at Pinnacle. Matthew brings structure and precision to every program. His approach is methodical — he believes that consistency built on the right foundation is what produces lasting results.',
    order: 2,
  },
]

export default function CoachesPage() {
  const coaches: Coach[] = fallbackCoaches

  return (
    <div className="bg-[#E8E4DC] min-h-screen pt-20">
      {/* Header */}
      <div className="py-20 px-6 sm:px-12 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
        <div>
          <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">The Team</p>
          <h1 className="font-serif text-4xl sm:text-5xl text-[#3A3733]">The people behind Pinnacle.</h1>
        </div>
        <div className="flex items-center md:pt-10">
          <p className="text-[#6B6560] text-lg leading-relaxed">
            Our coaches are more than trainers. Each brings a distinct expertise and a shared belief that the right environment changes everything.
          </p>
        </div>
      </div>

      {/* Coach cards */}
      <div className="px-6 sm:px-12 pb-20 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {coaches.map((coach) => (
            <div
              key={coach.id}
              className="bg-white rounded-2xl border border-[#CCC8C0] p-8"
            >
              <h2 className="font-serif text-xl text-[#3A3733] mb-1">{coach.name}</h2>
              <p className="text-[#3A3733] text-sm font-medium">
                {coach.specialties[0]}
              </p>
              {coach.bio && (
                <p className="text-[#6B6560] text-sm mt-4 leading-relaxed">{coach.bio}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
