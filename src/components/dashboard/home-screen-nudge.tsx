'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { isStandalone } from '@/lib/install/detect'

const subscribe = () => () => {}

// One line, only in a browser tab: the app is meant to live on the home
// screen so the QR is one tap away at the door.
export default function HomeScreenNudge() {
  const show = useSyncExternalStore(
    subscribe,
    () => !isStandalone(),
    () => false
  )
  if (!show) return null
  return (
    <Link
      href="/install"
      className="inline-flex items-center gap-2 text-xs text-ice-mute underline underline-offset-4"
    >
      Add Pinnacle to your home screen so this is one tap away
    </Link>
  )
}
