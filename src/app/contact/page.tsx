import type { Metadata } from 'next'
import { getBaseUrl } from '@/utils/getBaseUrl'
import ContactView from '@/views/contact-view/contact-view'

const baseUrl = getBaseUrl()

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with The Worx coworking space in Port of Spain, Trinidad. Book a tour, ask about memberships, or plan a co-branded event with us.',
  alternates: {
    canonical: `${baseUrl}/contact`,
  },
  openGraph: {
    title: 'Contact Us | The Worx',
    description:
      'Get in touch with The Worx coworking space in Port of Spain, Trinidad. Book a tour, ask about memberships, or plan a co-branded event with us.',
    url: `${baseUrl}/contact`,
  },
}

export default function ContactPage() {
  return <ContactView />
}
