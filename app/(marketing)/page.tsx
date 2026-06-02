import Link from 'next/link'

const features = [
  {
    icon: '🏋️',
    title: 'State-of-the-Art Equipment',
    desc: 'Over 200 machines and free-weight stations, maintained and updated yearly.',
  },
  {
    icon: '🧑‍🏫',
    title: 'Expert Coaches',
    desc: 'Certified personal trainers with specialties in strength, cardio, nutrition, and more.',
  },
  {
    icon: '🧖',
    title: 'Recovery Suite',
    desc: 'Sauna, steam room, ice bath, and massage chairs — because recovery is training too.',
  },
  {
    icon: '📱',
    title: 'Member App & QR Check-In',
    desc: 'Digital membership card with QR code. No fob needed — your phone is your key.',
  },
  {
    icon: '🥗',
    title: 'Nutrition Bar',
    desc: 'Post-workout smoothies, protein shakes, and healthy snacks on-site.',
  },
  {
    icon: '⏰',
    title: '24/7 Elite Access',
    desc: 'Elite members get round-the-clock access — train on your schedule, not ours.',
  },
]

const stats = [
  { value: '12K+', label: 'Active Members' },
  { value: '40+', label: 'Group Classes/Week' },
  { value: '25', label: 'Expert Coaches' },
  { value: '5★', label: 'Average Rating' },
]

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-zinc-950">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-orange-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-medium text-orange-400 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
            Now accepting new members
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white tracking-tight leading-[1.05]">
            Train Like You
            <br />
            <span className="text-orange-500">Mean It.</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Pinnacle Fitness is the premium gym experience for people serious about results.
            World-class equipment, elite coaching, and a community that pushes you further.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/auth"
              className="rounded-xl bg-orange-500 px-8 py-3.5 text-sm font-bold text-white hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/20"
            >
              Start Your Membership
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-zinc-700 px-8 py-3.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              View Plans
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-zinc-800 bg-zinc-900/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map(({ value, label }) => (
              <div key={label}>
                <p className="text-3xl sm:text-4xl font-black text-orange-500">{value}</p>
                <p className="text-sm text-zinc-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 md:py-28">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-white">Everything You Need</h2>
          <p className="mt-3 text-zinc-500 max-w-lg mx-auto text-sm sm:text-base">
            From cutting-edge equipment to expert coaching — we've built the ultimate training environment.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-6 hover:border-orange-500/40 hover:bg-zinc-900/80 transition-all"
            >
              <div className="mb-4 text-3xl">{icon}</div>
              <h3 className="font-bold text-white mb-2 text-sm sm:text-base">{title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-orange-500 px-8 py-14 text-center">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 blur-2xl translate-x-16 -translate-y-16" />
            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-black/10 blur-2xl -translate-x-16 translate-y-16" />
          </div>
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-black text-white">Ready to Hit Pinnacle?</h2>
            <p className="mt-3 text-orange-100 text-sm sm:text-base max-w-md mx-auto">
              Join thousands of members already training smarter. No contracts, cancel anytime.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/auth"
                className="rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-orange-600 hover:bg-orange-50 transition-colors"
              >
                Join Now — It's Free to Sign Up
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-white/30 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                See Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
