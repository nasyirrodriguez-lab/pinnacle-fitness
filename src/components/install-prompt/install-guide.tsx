'use client'

import Link from 'next/link'
import {
  Download,
  Share,
  Plus,
  Menu,
  MoreHorizontal,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useInstall } from '@/lib/install/use-install'

// Full per-platform install guide. Rendered at /install. Picks the most
// relevant section for the current browser and shows it expanded, with
// the others available below for anyone who's reading on a different
// device than they want to install on.
export default function InstallGuide() {
  const { env, triggerNativeInstall } = useInstall()

  if (env?.isStandalone) {
    return (
      <div className="bg-turquoise-50 border border-turquoise-200 rounded-lg p-6 flex items-start gap-4">
        <CheckCircle2 size={28} className="text-turquoise-600 shrink-0" />
        <div>
          <p className="font-heading text-lg mb-1">You&apos;re already in.</p>
          <p className="text-sm text-neutral-700">
            Pinnacle is installed on this device. Your home-screen icon opens
            straight to your dashboard.
          </p>
        </div>
      </div>
    )
  }

  // Pick the section that matches the current environment so we lead
  // with the most relevant guide. Others stay below as collapsibles.
  let primary: 'ios-safari' | 'ios-other' | 'android-chrome' | 'android-other' =
    'ios-safari'
  if (env) {
    if (env.isIosNonSafari) primary = 'ios-other'
    else if (env.os === 'android' && env.supportsBeforeInstallPrompt) {
      primary = 'android-chrome'
    } else if (env.os === 'android') primary = 'android-other'
    else if (env.os === 'ios') primary = 'ios-safari'
  }

  return (
    <div className="space-y-4">
      <Guide
        kind={primary}
        expanded
        triggerNativeInstall={triggerNativeInstall}
      />
      {primary !== 'ios-safari' && <Guide kind="ios-safari" />}
      {primary !== 'ios-other' && <Guide kind="ios-other" />}
      {primary !== 'android-chrome' && (
        <Guide
          kind="android-chrome"
          triggerNativeInstall={triggerNativeInstall}
        />
      )}
      {primary !== 'android-other' && <Guide kind="android-other" />}

      <p className="text-sm text-neutral-500 mt-8">
        Installing Pinnacle adds it to your home screen and lets it open
        full-screen, like a native app. It&apos;s the same website underneath —
        your sign-in carries over.
      </p>

      <Link
        href="/dashboard"
        className="block mt-6 text-sm text-turquoise-700 hover:text-turquoise-900 underline"
      >
        ← Back to dashboard
      </Link>
    </div>
  )
}

type GuideKind = 'ios-safari' | 'ios-other' | 'android-chrome' | 'android-other'

interface GuideProps {
  kind: GuideKind
  expanded?: boolean
  triggerNativeInstall?:
    | (() => Promise<'accepted' | 'dismissed'>)
    | null
    | undefined
}

function Guide({ kind, expanded = false, triggerNativeInstall }: GuideProps) {
  const Component = expanded ? ExpandedCard : CollapsibleCard
  return (
    <Component title={titleFor(kind)} subtitle={subtitleFor(kind)}>
      <GuideBody kind={kind} triggerNativeInstall={triggerNativeInstall} />
    </Component>
  )
}

function titleFor(kind: GuideKind): string {
  switch (kind) {
    case 'ios-safari':
      return 'iPhone or iPad — Safari'
    case 'ios-other':
      return 'iPhone or iPad — Chrome / Firefox / other'
    case 'android-chrome':
      return 'Android — Chrome, Edge, or Samsung Internet'
    case 'android-other':
      return 'Android — Firefox or other'
  }
}

function subtitleFor(kind: GuideKind): string {
  switch (kind) {
    case 'ios-safari':
      return 'A few taps from the Share menu'
    case 'ios-other':
      return "Switch to Safari first — Apple doesn't allow PWA install elsewhere"
    case 'android-chrome':
      return 'One-tap install'
    case 'android-other':
      return 'Two taps from the menu'
  }
}

function GuideBody({
  kind,
  triggerNativeInstall,
}: {
  kind: GuideKind
  triggerNativeInstall?:
    | (() => Promise<'accepted' | 'dismissed'>)
    | null
    | undefined
}) {
  if (kind === 'ios-safari') {
    return (
      <ol className="space-y-3 text-sm text-neutral-700">
        <Step n={1} icon={<Share size={16} className="text-turquoise-700" />}>
          Open the <strong>Share</strong> menu (the square with the up-arrow).
          On newer iPhones it&apos;s in the bottom Safari toolbar. If you
          don&apos;t see it, tap the{' '}
          <MoreHorizontal
            size={16}
            className="inline align-text-bottom text-turquoise-700"
          />{' '}
          <strong>three dots</strong> at the bottom-right of Safari first, then
          tap <strong>Share</strong>.
        </Step>
        <Step n={2} icon={<Plus size={16} className="text-turquoise-700" />}>
          Scroll down and tap <strong>Add to Home Screen</strong>.
        </Step>
        <Step n={3}>
          Tap <strong>Add</strong> in the top-right. Pinnacle now lives on your
          home screen.
        </Step>
      </ol>
    )
  }

  if (kind === 'ios-other') {
    return (
      <div className="space-y-3 text-sm text-neutral-700">
        <p>
          Apple blocks app install from non-Safari browsers on iOS. You can
          still use pinnaclefitness.app here, but to get the home-screen icon you need
          Safari.
        </p>
        <ol className="space-y-3">
          <Step n={1}>
            Copy the URL: <code>pinnaclefitness.app</code>
          </Step>
          <Step n={2}>
            Open <strong>Safari</strong> and paste it into the address bar.
          </Step>
          <Step n={3}>
            Follow the Safari instructions above (Share &rarr; Add to Home
            Screen).
          </Step>
        </ol>
      </div>
    )
  }

  if (kind === 'android-chrome') {
    return (
      <div className="space-y-4 text-sm text-neutral-700">
        {triggerNativeInstall ? (
          <>
            <p>
              We can show the install dialog directly. Tap the button below.
            </p>
            <Button
              type="button"
              onClick={() => void triggerNativeInstall()}
              className="w-full sm:w-auto"
            >
              <Download size={16} className="mr-2" />
              Install Pinnacle
            </Button>
            <p className="text-xs text-neutral-500">
              Not seeing the dialog? Tap the ⋮ menu and choose{' '}
              <strong>Install app</strong>.
            </p>
          </>
        ) : (
          <ol className="space-y-3">
            <Step
              n={1}
              icon={<Menu size={16} className="text-turquoise-700" />}
            >
              Tap the <strong>⋮</strong> menu in the top-right.
            </Step>
            <Step n={2}>
              Tap <strong>Install app</strong> or{' '}
              <strong>Add to Home screen</strong>.
            </Step>
            <Step n={3}>
              Confirm <strong>Install</strong>.
            </Step>
          </ol>
        )}
      </div>
    )
  }

  // android-other
  return (
    <ol className="space-y-3 text-sm text-neutral-700">
      <Step n={1} icon={<Menu size={16} className="text-turquoise-700" />}>
        Open the browser&apos;s main menu.
      </Step>
      <Step n={2}>
        Look for <strong>Install app</strong>,{' '}
        <strong>Add to Home screen</strong>, or <strong>Install</strong>.
        Firefox calls it <strong>Install</strong> in the address bar.
      </Step>
      <Step n={3}>
        Confirm and you&apos;re done. Pinnacle appears in your app drawer.
      </Step>
    </ol>
  )
}

function Step({
  n,
  icon,
  children,
}: {
  n: number
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="w-6 h-6 rounded-full bg-turquoise-100 text-turquoise-800 text-xs font-medium flex items-center justify-center shrink-0">
        {n}
      </span>
      <span className="flex-1 leading-relaxed">
        {icon && (
          <span className="inline-flex items-center mr-1.5">{icon}</span>
        )}
        {children}
      </span>
    </li>
  )
}

function ExpandedCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border-2 border-turquoise-200 rounded-lg p-6">
      <p className="text-xs uppercase tracking-wide text-turquoise-700 font-medium mb-1">
        For your device
      </p>
      <h2 className="font-heading text-xl mb-1">{title}</h2>
      <p className="text-sm text-neutral-500 mb-5">{subtitle}</p>
      {children}
    </div>
  )
}

function CollapsibleCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <details className="bg-white border border-neutral-200 rounded-lg group">
      <summary className="cursor-pointer p-5 flex items-center justify-between gap-3 list-none">
        <div>
          <h2 className="font-heading text-base mb-0.5">{title}</h2>
          <p className="text-xs text-neutral-500">{subtitle}</p>
        </div>
        <span className="text-neutral-400 group-open:rotate-180 transition-transform">
          ▾
        </span>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  )
}
