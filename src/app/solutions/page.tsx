import type { Metadata } from 'next'
import { getBaseUrl } from '@/utils/getBaseUrl'
import ServicesView from '@/views/services-view/services-view'

const baseUrl = getBaseUrl()

export const metadata: Metadata = {
  title: 'Workspace Solutions',
  description:
    'Hot desks, dedicated desks, private offices, meeting rooms, and event spaces at The Worx coworking space in Port of Spain, Trinidad.',
  alternates: {
    canonical: `${baseUrl}/solutions`,
  },
  openGraph: {
    title: 'Workspace Solutions | The Worx',
    description:
      'Hot desks, dedicated desks, private offices, meeting rooms, and event spaces at The Worx coworking space in Port of Spain, Trinidad.',
    url: `${baseUrl}/solutions`,
  },
}

export default function SolutionsPage() {
  return <ServicesView />
}
