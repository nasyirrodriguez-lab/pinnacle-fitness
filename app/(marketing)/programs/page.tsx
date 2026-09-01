import Link from 'next/link'

export default function ProgramsPage() {
  return (
    <div className="bg-[#D6D3CC] min-h-screen pt-20">
      {/* Header */}
      <div className="py-20 px-6 sm:px-12 max-w-6xl mx-auto">
        <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">Programs</p>
        <h1 className="font-serif text-5xl sm:text-7xl text-[#1C1A17] leading-tight">
          Train with <em className="text-[#54504A] not-italic font-serif">intention</em>.
        </h1>
        <p className="text-[#6B6560] text-lg max-w-2xl mt-6 leading-relaxed">
          Every program at Pinnacle is crafted to deliver results — not just effort. Choose your path and let our coaches take you there.
        </p>
      </div>

      {/* Program list */}
      <div className="border-t border-[#C4C1BA] divide-y divide-[#C4C1BA]">

        {/* Strength Training */}
        <div className="py-10 px-6 sm:px-12 max-w-6xl mx-auto flex items-start gap-8">
          <div className="w-16 h-16 rounded-xl bg-[#C4C1BA] flex items-center justify-center text-sm font-mono font-semibold text-[#6B6560] flex-shrink-0">
            ST
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-2xl text-[#1C1A17] mb-3">Strength Training</h2>
            <p className="text-[#6B6560] leading-relaxed max-w-2xl">
              Built for people who want to get stronger — no matter where they are starting from. Our strength programming is progressive, structured, and coached so you are never guessing. You will build real muscle, real confidence, and a real habit. Show up, lift, repeat.
            </p>
          </div>
        </div>

        {/* Sport Specific - FEATURED */}
        <div className="bg-[#1F3D2B]">
          <div className="py-10 px-6 sm:px-12 max-w-6xl mx-auto flex items-start gap-8">
            <div className="w-16 h-16 rounded-xl bg-[#54504A] flex items-center justify-center text-sm font-mono font-semibold text-white flex-shrink-0">
              SP
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#54504A] mb-3">Athlete Program</p>
              <h2 className="font-serif text-2xl text-white mb-3">Sport Specific Performance</h2>
              <p className="text-white/80 leading-relaxed max-w-2xl">
                Designed exclusively for competitive athletes who need targeted development to elevate their game. Stefan&apos;s sport-specific methodology identifies the precise physical deficiencies — explosive power, lateral quickness, deceleration mechanics, positional strength — that are limiting your performance on the field or court. This is not general fitness. This is precision work built around your sport, your position, and your next level.
              </p>
            </div>
          </div>
        </div>

        {/* Bootcamps */}
        <div className="py-10 px-6 sm:px-12 max-w-6xl mx-auto flex items-start gap-8">
          <div className="w-16 h-16 rounded-xl bg-[#C4C1BA] flex items-center justify-center text-sm font-mono font-semibold text-[#6B6560] flex-shrink-0">
            BC
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-2xl text-[#1C1A17] mb-3">Bootcamps</h2>
            <p className="text-[#6B6560] leading-relaxed max-w-2xl">
              This is where the community comes alive. High-energy group sessions on the turf that mix strength, cardio, and the kind of collective grind that makes you forget how hard you are working. You will push because the person next to you is pushing — and that is the whole point.
            </p>
          </div>
        </div>

        {/* Open Gym */}
        <div className="py-10 px-6 sm:px-12 max-w-6xl mx-auto flex items-start gap-8">
          <div className="w-16 h-16 rounded-xl bg-[#C4C1BA] flex items-center justify-center text-sm font-mono font-semibold text-[#6B6560] flex-shrink-0">
            OG
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-2xl text-[#1C1A17] mb-3">Open Gym</h2>
            <p className="text-[#6B6560] leading-relaxed max-w-2xl">
              Your schedule, your workout, your pace. Full access to every corner of the facility — weights, machines, and turf — whenever you need it. Some of our best members come in, put their headphones on, do the work, and leave better than they arrived. Simple as that.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom CTA banner */}
      <div className="bg-[#1F3D2B] py-14 px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-serif text-2xl text-white">Members get unlimited access to every program.</p>
            <p className="text-white/60 text-sm mt-1">Drop-ins welcome — buy a single-class pass at the front desk or online.</p>
          </div>
          <Link
            href="/pricing"
            className="bg-[#54504A] text-white rounded-full px-7 py-3 text-sm font-medium hover:bg-[#3d3a35] transition-colors whitespace-nowrap flex-shrink-0"
          >
            See memberships
          </Link>
        </div>
      </div>
    </div>
  )
}
