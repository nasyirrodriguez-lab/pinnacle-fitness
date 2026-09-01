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
        <div className="relative flex flex-col justify-end min-h-screen pb-16 px-6 sm:px-12 max-w-4xl">
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
              className="bg-[#54504A] text-white rounded-full px-7 py-3 text-sm font-medium hover:bg-[#3d3a35] transition-colors"
            >
              Become a member ↗
            </Link>
            <Link
              href="/free-trial"
              className="border border-white text-white rounded-full px-7 py-3 text-sm font-medium hover:bg-white/10 transition-colors"
            >
              Try a free class
            </Link>
          </div>
        </div>
      </section>

      {/* Free trial banner */}
      <section className="bg-[#1F3D2B] py-4 px-6 text-center">
        <p className="text-white/90 text-sm">
          <span className="font-semibold text-white">First Class Free</span>
          {' '}—{' '}
          No membership required. Try any class on us.{' '}
          <Link href="/free-trial" className="underline text-[#54504A] hover:text-[#e07050] transition-colors font-medium">
            Book now →
          </Link>
        </p>
      </section>

      {/* Section 2 - What we're about */}
      <section className="bg-[#D6D3CC]">
        <div className="px-6 sm:px-12 py-20 max-w-6xl mx-auto">
          <h2 className="font-serif text-4xl sm:text-5xl mb-12 text-[#1C1A17]">What we&apos;re about.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-[#C4C1BA] p-8">
              <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">Community</p>
              <p className="text-[#1C1A17] leading-relaxed">
                Train alongside people who push you, know you, and show up with you.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-[#C4C1BA] p-8">
              <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">Outdoor setting</p>
              <p className="text-[#1C1A17] leading-relaxed">
                Open skies, full weight floor, machines, and a dedicated turf area.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-[#C4C1BA] p-8 md:col-span-2">
              <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#6B6560] mb-4">Real results</p>
              <p className="text-[#1C1A17] leading-relaxed">
                Structured programming built around your goals — not just your effort.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 - Belief */}
      <section className="bg-[#D6D3CC]">
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
      <section className="bg-[#D6D3CC] py-24 px-6 text-center">
        <h2 className="font-serif text-4xl sm:text-6xl text-[#1C1A17] mb-4">Come try a day on us.</h2>
        <p className="text-[#6B6560] max-w-xl mx-auto mt-4 text-lg">
          Walk in for a class, a lift, or one on one. The fastest way to know if this place is for you is to be in it.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link
            href="/free-trial"
            className="bg-[#54504A] text-white rounded-full px-7 py-3 text-sm font-medium hover:bg-[#3d3a35] transition-colors inline-block"
          >
            Book a free class
          </Link>
          <Link
            href="/auth"
            className="border border-[#1C1A17] text-[#1C1A17] rounded-full px-7 py-3 text-sm font-medium hover:bg-[#1C1A17] hover:text-white transition-colors inline-block"
          >
            Become a member
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
      <section className="bg-[#D6D3CC]">
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
              <span className="text-[#54504A] text-xs tracking-[0.15em] uppercase font-medium">Outdoor Setting</span>
              <span className="text-[#C4C1BA]">•</span>
              <span className="text-[#54504A] text-xs tracking-[0.15em] uppercase font-medium">Free Weights &amp; Machines</span>
              <span className="text-[#C4C1BA]">•</span>
              <span className="text-[#54504A] text-xs tracking-[0.15em] uppercase font-medium">Turf Zone</span>
              <span className="text-[#C4C1BA]">•</span>
              <span className="text-[#54504A] text-xs tracking-[0.15em] uppercase font-medium">Community First</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 7 - Instagram */}
      <section className="bg-white py-20 px-6 sm:px-12">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] mb-6">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#1C1A17] mb-3">Follow us on Instagram</h2>
          <p className="text-[#6B6560] text-lg mb-8">@pinnaclefitnessandfootball</p>
          <a
            href="https://www.instagram.com/pinnaclefitnessandfootball"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#54504A] hover:bg-[#3d3a35] text-white font-medium rounded-full px-7 py-3 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            Follow on Instagram
          </a>
        </div>
      </section>
    </>
  )
}
