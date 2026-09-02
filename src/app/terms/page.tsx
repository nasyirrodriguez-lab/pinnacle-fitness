import type { Metadata } from 'next'
import TermsContent from '@/components/terms/terms-content'

export const metadata: Metadata = {
  title: 'Terms and Conditions — Pinnacle Fitness',
  description:
    'Membership terms and conditions for Pinnacle Fitness at The Playground, Port of Spain.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
      <TermsContent />
    </div>
  )
}
