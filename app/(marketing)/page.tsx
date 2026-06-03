import Link from 'next/link'

export default function HomePage() {
  return (
    <>
      {/* Section 1 - Hero */}
      <section
        className="min-h-screen relative"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/55 pointer-events-none" />
        <div className="relative z-10 flex flex-col justify-end min-h-screen pb-16 px-6 sm:px-12 max-w-4xl">
          <p className="text-xs font-medium tracking-[0.15em] uppercase text-white/60 mb-4">
            Pinnacle GYM
          </p>
          <h1 className="font-serif text-5xl sm:text-7xl font-normal text-white leading-tight mb-6">
            Train with us.
          </h1>
          <p className="text-white/80 text-lg max-w-xl mb-10">
            Pinnacle Fitness is where people come to train hard, find their rhythm, and build something together.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/auth"
              className="bg-[#C85C2D] text-white rounded-full px-7 py-3 text-sm font-medium hover:bg-[#b34f26] transition-colors"
            >
              Become a member ↗
            </Link>
            <Link
              href="/programs"
              className="border border-white text-white rounded-full px-7 py-3 text-sm font-medium hover:bg-white/10 transition-colors"
            >
              See programs
            </Link>
          </div>
        </div>
      </section>

      {/* Section 2 - What we're about */}
      <section className="bg-[#F5F0E8]">
        <div className="px-6 sm:px-12 py-20 max-w-6xl mx-auto">
          <h2 className="font-serif text-4xl sm:text-5xl mb-12 text-[#1C1A17]">What we&apos;re about.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-[#E8E3D9] p-8">
              <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">Community</p>
              <p className="text-[#1C1A17] leading-relaxed">
                Train alongside people who push you, know you, and show up with you.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-[#E8E3D9] p-8">
              <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">Outdoor setting</p>
              <p className="text-[#1C1A17] leading-relaxed">
                Open skies, full weight floor, machines, and a dedicated turf area.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-[#E8E3D9] p-8 md:col-span-2">
              <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">Real results</p>
              <p className="text-[#1C1A17] leading-relaxed">
                Structured programming built around your goals — not just your effort.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 - Belief */}
      <section className="bg-[#F5F0E8]">
        <div className="px-6 sm:px-12 py-20 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">Our Belief</p>
            <h2 className="font-serif text-4xl sm:text-5xl text-[#1C1A17]">Built for the everyday person.</h2>
          </div>
          <div>
            <p className="text-[#6B6560] text-lg leading-relaxed">
              Pinnacle Fitness was built on one idea — that the right environment changes everything. We are an outdoor training community where progress is the goal, and the people around you make it happen.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4 - CTA */}
      <section className="bg-[#F5F0E8] py-24 px-6 text-center">
        <h2 className="font-serif text-4xl sm:text-6xl text-[#1C1A17] mb-4">Come try a day on us.</h2>
        <p className="text-[#6B6560] max-w-xl mx-auto mt-4 text-lg">
          Walk in for a class, a lift, or one on one. The fastest way to know if this place is for you is to be in it.
        </p>
        <div className="mt-10">
          <Link
            href="/auth"
            className="bg-[#C85C2D] text-white rounded-full px-7 py-3 text-sm font-medium hover:bg-[#b34f26] transition-colors inline-block"
          >
            Get started
          </Link>
        </div>
      </section>

      {/* Section 5 - Full-width photo */}
      <section
        className="relative h-[60vh] min-h-[400px]"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1920&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/60 pointer-events-none" />
        <div className="absolute bottom-0 left-0 p-12">
          <p className="text-xs font-medium tracking-[0.15em] uppercase text-white/60 mb-4">The Club</p>
          <h2 className="font-serif text-4xl sm:text-6xl text-white">
            Built for everyday people who show up.
          </h2>
        </div>
      </section>

      {/* Section 6 - Club details */}
      <section className="bg-[#F5F0E8]">
        <div className="px-6 sm:px-12 py-20 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">The Club</p>
            <h2 className="font-serif text-4xl text-[#1C1A17]">Just show up — we&apos;ll handle the rest.</h2>
          </div>
          <div>
            <p className="text-[#6B6560] leading-relaxed mb-4">
              Pinnacle is more than a gym. It&apos;s a place people actually want to be. The space is intentional, the coaching is real, and the community is the kind that keeps you coming back.
            </p>
            <p className="text-[#6B6560] leading-relaxed mb-8">
              Whether you&apos;re here for your first session or your thousandth, you&apos;ll find exactly what you need to move forward.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[#C85C2D] text-xs tracking-[0.15em] uppercase font-medium">Outdoor Setting</span>
              <span className="text-[#E8E3D9]">•</span>
              <span className="text-[#C85C2D] text-xs tracking-[0.15em] uppercase font-medium">Free Weights &amp; Machines</span>
              <span className="text-[#E8E3D9]">•</span>
              <span className="text-[#C85C2D] text-xs tracking-[0.15em] uppercase font-medium">Turf Zone</span>
              <span className="text-[#E8E3D9]">•</span>
              <span className="text-[#C85C2D] text-xs tracking-[0.15em] uppercase font-medium">Community First</span>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
