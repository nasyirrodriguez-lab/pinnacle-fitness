'use client'

import { useSyncExternalStore } from 'react'
import { detectInstallEnv, type InstallEnv } from './detect'

// Chromium fires this when a site is install-eligible. We capture the
// event so we can fire it later from our own button.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Module-level singleton — only one source of truth, only one listener
// per page load.
let cachedPromptEvent: BeforeInstallPromptEvent | null = null
const subscribers = new Set<() => void>()

function emit() {
  subscribers.forEach((cb) => cb())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar in Chrome; we'll show our own UI.
    e.preventDefault()
    cachedPromptEvent = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    cachedPromptEvent = null
    emit()
  })
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}

function noopSubscribe(): () => void {
  return () => {}
}

function getPromptSnapshot(): BeforeInstallPromptEvent | null {
  return cachedPromptEvent
}

function getServerSnapshot(): BeforeInstallPromptEvent | null {
  return null
}

// detectInstallEnv() builds a new object literal every time. React's
// useSyncExternalStore requires the snapshot to be referentially stable
// across calls within a render pass — otherwise the store appears
// "changed" on every render and React keeps re-rendering forever
// (error #185). Cache once and return the cached reference.
let cachedEnv: InstallEnv | null = null
function getEnvSnapshot(): InstallEnv | null {
  if (!cachedEnv && typeof window !== 'undefined') {
    cachedEnv = detectInstallEnv()
  }
  return cachedEnv
}
function getEnvServerSnapshot(): InstallEnv | null {
  return null
}

export interface UseInstallReturn {
  env: InstallEnv | null
  // Available when the browser has fired `beforeinstallprompt`. Calling
  // this triggers the native install dialog.
  triggerNativeInstall: (() => Promise<'accepted' | 'dismissed'>) | null
}

// Returns the install environment + a function to trigger the native
// install dialog if available. Both are null on first server render and
// settle on the client after mount.
export function useInstall(): UseInstallReturn {
  const promptEvent = useSyncExternalStore(
    subscribe,
    getPromptSnapshot,
    getServerSnapshot
  )

  // env is derived from window so we need useSyncExternalStore with a
  // no-op subscribe to defer reading the OS/browser until after hydration.
  // The values themselves don't change during a session — cached via
  // getEnvSnapshot so the reference is stable.
  const env = useSyncExternalStore<InstallEnv | null>(
    noopSubscribe,
    getEnvSnapshot,
    getEnvServerSnapshot
  )

  const triggerNativeInstall = promptEvent
    ? async () => {
        await promptEvent.prompt()
        const { outcome } = await promptEvent.userChoice
        // Per spec, the event can't be used twice.
        cachedPromptEvent = null
        emit()
        return outcome
      }
    : null

  return { env, triggerNativeInstall }
}
