import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import type { Coach } from '@/lib/types'

const fallbackCoaches: Coach[] = [
  {
    id: '1',
    name: 'Marcus Rivera',
    photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus&backgroundColor=b6e3f4',
    specialties: ['Strength & Conditioning', 'Powerlifting', 'Sports Performance'],
    bio: 'Former collegiate athlete with 10+ years of coaching experience. Marcus specializes in building raw strength and athletic performance through evidence-based programming.',
    order: 1,
  },
  {
    id: '2',
    name: 'Priya Nair',
    photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya&backgroundColor=d1d4f9',
    specialties: ['Yoga & Mobility', 'Functional Fitness', 'Rehabilitation'],
    bio: 'Certified yoga instructor and functional movement specialist. Priya helps clients move pain-free, improve flexibility, and build a body that lasts.',
    order: 2,
  },
  {
    id: '3',
    name: 'Jake Thompson',
    photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jake&backgroundColor=c0aede',
    specialties: ['HIIT & Cardio', 'Weight Loss', 'Group Classes'],
    bio: 'High-energy coach who thrives in group settings. Jake\'s HIIT sessions are legendary — expect to work hard, laugh harder, and see real results.',
    order: 3,
  },
  {
    id: '4',
    name: 'Sofia Mendes',
    photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sofia&backgroundColor=ffdfbf',
    specialties: ['Nutrition Coaching', 'Body Composition', 'Mindset & Wellness'],
    bio: 'Registered dietitian turned personal trainer. Sofia takes a holistic approach to health — because what you eat and how you think matters as much as how you train.',
    order: 4,
  },
  {
    id: '5',
    name: 'Deon Williams',
    photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Deon&backgroundColor=ffd5dc',
    specialties: ['Boxing & Combat Fitness', 'Cardio Conditioning', 'Confidence Building'],
    bio: 'Ex-amateur boxer turned certified PT. Deon brings intensity and discipline from the ring to every training session — beginners and advanced athletes alike.',
    order: 5,
  },
  {
    id: '6',
    name: 'Lena Kowalski',
    photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lena&backgroundColor=b6e3f4',
    specialties: ['Pilates', 'Posture Correction', 'Pre/Postnatal Fitness'],
    bio: 'Pilates-certified trainer with a background in dance. Lena\'s clients love her attention to form, her calming coaching style, and the deep core burn she delivers.',
    order: 6,
  },
]

export default async function CoachesPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('coaches').select('*').order('order')
  const coaches: Coach[] = (data && data.length > 0) ? data : fallbackCoaches

  return (
    <div className="bg-zinc-950">
      {/* Header */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-black text-white">Meet Your Coaches</h1>
        <p className="mt-4 text-zinc-400 max-w-lg mx-auto text-sm sm:text-base">
          Our certified coaches bring real-world experience, deep expertise, and genuine passion for helping you reach your goals.
        </p>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {coaches.map((coach) => (
            <div
              key={coach.id}
              className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden hover:border-zinc-700 transition-colors"
            >
              {/* Photo */}
              <div className="flex items-center justify-center bg-zinc-800 h-52">
                <div className="relative h-36 w-36 rounded-full overflow-hidden border-4 border-zinc-700 bg-zinc-700">
                  <Image
                    src={coach.photo_url}
                    alt={coach.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              </div>

              {/* Info */}
              <div className="p-6 flex flex-col flex-1">
                <h2 className="text-lg font-bold text-white">{coach.name}</h2>

                {/* Specialties */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {coach.specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-orange-500/15 border border-orange-500/25 px-2.5 py-0.5 text-xs font-medium text-orange-400"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <p className="mt-4 text-sm text-zinc-500 leading-relaxed flex-1">{coach.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
          <h2 className="text-2xl font-black text-white">Train with the Best</h2>
          <p className="mt-2 text-zinc-500 text-sm max-w-sm mx-auto">
            Elite and Premium members get access to personal training sessions with our coaches.
          </p>
          <a
            href="/pricing"
            className="mt-6 inline-block rounded-xl bg-orange-500 px-8 py-3 text-sm font-bold text-white hover:bg-orange-400 transition-colors"
          >
            View Plans
          </a>
        </div>
      </section>
    </div>
  )
}
