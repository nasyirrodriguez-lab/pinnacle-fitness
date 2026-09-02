import type { Metadata } from 'next'
import BankDetailsView from '@/views/bank-details-view/bank-details-view'

export const metadata: Metadata = {
  title: 'Bank Details',
  robots: {
    index: false,
    follow: false,
  },
}

export default function BankDetailsPage() {
  return <BankDetailsView />
}
