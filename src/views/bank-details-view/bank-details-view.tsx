'use client'

import { Fragment } from 'react'
import Faqs from '@/components/faqs/faqs'

function BankDetailsView() {
  return (
    <Fragment>
      <div className="py-16 bg-neutral-100">
        <div className="max-w-7xl mx-auto px-12">
          <div className="max-w-3xl">
            <h1 className="inline-block mb-8 py-2 px-4 text-white bg-neutral-900 text-4xl">
              Bank Details
            </h1>
            <h2 className="text-neutral-900 text-xl mb-4">
              Making a bank transfer? It&apos;s easy! Just follow these steps:
            </h2>
            <p className="text-xl">1. Log in to your online banking account</p>
            <p className="text-xl">2. Select the option to make a transfer</p>
            <p className="text-xl">3. Enter the following details:</p>
            <div className="mt-4 mb-4 p-4 bg-white rounded">
              <p className="text-xl">
                <strong>Bank:</strong> Republic Bank
              </p>
              <p className="text-xl">
                <strong>Beneficiary:</strong> Caribbean Tech Hub Limited
              </p>
              <p className="text-xl">
                <strong>Account Number:</strong> 340802057901
              </p>
              <p className="text-xl">
                <strong>Account Type:</strong> Checking
              </p>
            </div>
            <p className="text-xl">
              4. When you&apos;re done, please send us a screenshot of the
              transfer confirmation to{' '}
              <a href="mailto:team@theworx.io">team@theworx.io</a>.
            </p>
          </div>
        </div>
      </div>
      <div className="py-24 px-12">
        <div className="max-w-4xl mx-auto">
          <Faqs />
        </div>
      </div>
    </Fragment>
  )
}

export default BankDetailsView
