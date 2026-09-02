'use client'

import GuestCheckinClient from './guest-checkin-client'

// Phone-side guest check-in. Re-uses the iPad wizard but submits to the
// public /api/checkin/phone-guest endpoint (no kiosk-device requirement).
export default function GuestPhoneCheckin() {
  return (
    <div>
      <div className="mb-6 text-center">
        <p className="text-xs uppercase tracking-wide text-turquoise-700 font-medium mb-2">
          Check in
        </p>
        <h1 className="font-heading text-3xl mb-1">Welcome to Pinnacle</h1>
        <p className="text-sm text-neutral-600">
          A few quick questions and we&apos;ll let the team know you&apos;re
          here.
        </p>
      </div>
      <GuestCheckinClient endpoint="/api/checkin/phone-guest" />
    </div>
  )
}
