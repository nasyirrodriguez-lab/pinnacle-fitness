export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-[#E8E3D9]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-baseline gap-1.5">
          <span className="font-serif italic text-xl text-[#1C1A17]">Pinnacle</span>
          <span className="text-xs tracking-[0.15em] uppercase font-medium text-[#6B6560]">GYM</span>
        </a>
        <nav className="hidden md:flex items-center gap-8">
          <a href="/programs" className="text-sm text-[#6B6560] hover:text-[#1C1A17] transition">Programs</a>
          <a href="/coaches" className="text-sm text-[#6B6560] hover:text-[#1C1A17] transition">Coaches</a>
          <a href="/pricing" className="text-sm text-[#6B6560] hover:text-[#1C1A17] transition">Pricing</a>
          <a href="/contact" className="text-sm text-[#6B6560] hover:text-[#1C1A17] transition">Contact</a>
        </nav>
        <div className="flex items-center gap-3">
          <a href="/free-trial" className="text-sm text-[#6B6560] hover:text-[#1C1A17] transition hidden md:block">Free Trial</a>
          <a href="/auth" className="px-4 py-2 bg-[#C85C2D] text-white text-sm font-medium rounded-full hover:bg-[#b34f26] transition">Join Now</a>
        </div>
      </div>
    </header>
  )
}
