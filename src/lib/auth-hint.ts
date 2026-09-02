'use client'

import { useSyncExternalStore } from 'react'

const SIGNED_IN_COOKIE = 'worx_signed_in'

function read(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie
    .split(';')
    .some((c) => c.trim().startsWith(`${SIGNED_IN_COOKIE}=1`))
}

const subscribe = () => () => {}
const getSnapshot = () => read()
const getServerSnapshot = () => false

export function useSignedInHint(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
