'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Download, Share, X, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useInstall } from '@/lib/install/use-install'

const DISMISS_KEY = 'worx_install_dismissed_at'
const DISMISS_WINDOW_DAYS = 30

// Bumped each time the user dismisses so React reads a fresh value
// without us calling setState in an effect.
let dismissTick = 0
const dismissSubscribers = new Set<() => void>()

function notifyDismiss() {
  dismissTick++
  dismissSubscribers.forEach((cb) => cb())
}

function subscribeDismiss(cb: () => void): () => void {
  dismissSubscribers.add(cb)
  return () => {
    dismissSubscribers.delete(cb)
  }
}

function getDismissSnapshot(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at)) return false
    const cutoff = Date.now() - DISMISS_WINDOW_DAYS * 24 * 60 * 60 * 1000
    return at > cutoff
  } catch {
    return false
  }
}

function getDismissServerSnapshot(): boolean {
  // On the server we assume dismissed so the banner never flashes during
  // hydration. The real value is read on the client.
  return true
}

function dismiss() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* localStorage disabled */
  }
  notifyDismiss()
}

// Contextual bottom banner. Shown inside the dashboard layout for
// signed-in members who haven't installed and haven't dismissed
// recently. Copy adapts to platform.
export default function InstallPrompt() {
  const { env, triggerNativeInstall } = useInstall()
  // Local dismiss state in addition to the persisted check, so dismissing
  // hides the banner immediately within this session without waiting for
  // a re-read.
  const [hiddenLocal, setHiddenLocal] = useState(false)
  const dismissed = useSyncExternalStore(
    subscribeDismiss,
    getDismissSnapshot,
    getDismissServerSnapshot
  )

  void dismissTick // keep the lint happy about the module-level counter

  if (hiddenLocal || dismissed || !env) return null
  if (env.isStandalone) return null

  // Desktop: leave them alone for now. The PWA experience matters most
  // on mobile.
  if (env.os !== 'ios' && env.os !== 'android') return null

  const onDismiss = () => {
    dismiss()
    setHiddenLocal(true)
  }

  return (
    <div
      className="md:hidden fixed inset-x-0 z-30 bottom-20 px-3 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="pointer-events-auto bg-darkBlue-900 text-white rounded-2xl shadow-lg p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center shrink-0">
          <Smartphone size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <Body
            env={env}
            onInstall={triggerNativeInstall}
            onDismiss={onDismiss}
          />
        </div>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={onDismiss}
          className="text-white/60 hover:text-white shrink-0 -mr-1 -mt-1 p-1"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

function Body({
  env,
  onInstall,
  onDismiss,
}: {
  env: ReturnType<typeof useInstall>['env']
  onInstall: ReturnType<typeof useInstall>['triggerNativeInstall']
  onDismiss: () => void
}) {
  if (!env) return null

  // iOS non-Safari can't install at all — Apple blocks PWA install
  // outside Safari. Best we can do is point them at Safari.
  if (env.isIosNonSafari) {
    return (
      <>
        <p className="font-medium text-sm mb-1">Get the app experience</p>
        <p className="text-xs text-white/80 mb-3">
          Open theworx.io in <strong>Safari</strong>, then tap Share &rarr; Add
          to Home Screen. iOS blocks app install from{' '}
          {env.browser === 'chrome' ? 'Chrome' : 'this browser'}.
        </p>
        <Link
          href="/install"
          onClick={onDismiss}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-turquoise-300 hover:text-turquoise-200 underline"
        >
          See full instructions
        </Link>
      </>
    )
  }

  // iOS Safari — manual instructions.
  if (env.os === 'ios') {
    return (
      <>
        <p className="font-medium text-sm mb-1">
          Add The Worx to your home screen
        </p>
        <p className="text-xs text-white/80 mb-3 flex items-center gap-1">
          Tap <Share size={14} className="inline mx-0.5" /> below &rarr;{' '}
          <strong>Add to Home Screen</strong>. One-tap check-in next visit.
        </p>
        <Link
          href="/install"
          onClick={onDismiss}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-turquoise-300 hover:text-turquoise-200 underline"
        >
          Show me how
        </Link>
      </>
    )
  }

  // Android with native install prompt available.
  if (env.os === 'android' && onInstall) {
    return (
      <>
        <p className="font-medium text-sm mb-1">
          Install The Worx for one-tap check-in
        </p>
        <p className="text-xs text-white/80 mb-3">
          Adds an icon to your home screen. Free, takes a second.
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={async () => {
            const outcome = await onInstall()
            if (outcome === 'accepted' || outcome === 'dismissed') {
              onDismiss()
            }
          }}
          className="bg-white text-darkBlue-900 hover:bg-neutral-100"
        >
          <Download size={14} className="mr-1.5" />
          Install
        </Button>
      </>
    )
  }

  // Android non-Chromium (Firefox, etc) — manual instructions.
  if (env.os === 'android') {
    return (
      <>
        <p className="font-medium text-sm mb-1">
          Add The Worx to your home screen
        </p>
        <p className="text-xs text-white/80 mb-3">
          Tap the menu and pick <strong>Install app</strong> or{' '}
          <strong>Add to Home screen</strong>.
        </p>
        <Link
          href="/install"
          onClick={onDismiss}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-turquoise-300 hover:text-turquoise-200 underline"
        >
          Show me how
        </Link>
      </>
    )
  }

  return null
}
