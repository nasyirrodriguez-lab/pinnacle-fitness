import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import WhatsAppButton from '@/components/marketing/WhatsAppButton'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#D6D3CC]">
      <Navbar />
      <main className="flex-1 pt-0">{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  )
}
