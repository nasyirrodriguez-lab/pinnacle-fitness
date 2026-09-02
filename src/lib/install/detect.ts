// Best-effort UA classification for the install-prompt experience. Lives
// in pure functions so it can be exercised from React components via
// useSyncExternalStore without setState-in-effect lint issues.
//
// UA sniffing is intentionally simple here — we don't make access
// decisions on it, only pick which install instructions to show.

export type Os = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'unknown'

export type Browser =
  | 'safari'
  | 'chrome'
  | 'firefox'
  | 'edge'
  | 'samsung'
  | 'opera'
  | 'other'

export interface InstallEnv {
  os: Os
  browser: Browser
  isStandalone: boolean
  // True if `beforeinstallprompt` will fire on this browser/OS combo.
  // Android Chromium-based browsers only.
  supportsBeforeInstallPrompt: boolean
  // True for iOS browsers other than Safari. These can't install at all
  // — Apple blocks PWA install outside Safari. We'll tell the user to
  // switch.
  isIosNonSafari: boolean
}

export function detectInstallEnv(): InstallEnv {
  if (typeof window === 'undefined') {
    return {
      os: 'unknown',
      browser: 'other',
      isStandalone: false,
      supportsBeforeInstallPrompt: false,
      isIosNonSafari: false,
    }
  }

  const ua = window.navigator.userAgent
  const platform = window.navigator.platform ?? ''
  const standalone = isStandalone()

  const os = detectOs(ua, platform)
  const browser = detectBrowser(ua)

  // iOS Chrome / Firefox / Edge all run under WebKit but identify
  // themselves in the UA via CriOS / FxiOS / EdgiOS. Treat any non-Safari
  // browser on iOS as iosNonSafari.
  const isIosNonSafari = os === 'ios' && browser !== 'safari'

  // `beforeinstallprompt` fires on Chromium-based browsers (Chrome,
  // Edge, Samsung, Opera) on Android + desktop. Never on iOS, never on
  // Firefox. We assume support on Android Chromium browsers; we verify
  // by actually capturing the event in the React layer.
  const supportsBeforeInstallPrompt =
    os === 'android' &&
    (browser === 'chrome' ||
      browser === 'edge' ||
      browser === 'samsung' ||
      browser === 'opera')

  return {
    os,
    browser,
    isStandalone: standalone,
    supportsBeforeInstallPrompt,
    isIosNonSafari,
  }
}

function detectOs(ua: string, platform: string): Os {
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  // iPadOS 13+ reports as Mac. Distinguish by touch support.
  if (
    /Mac/.test(platform) &&
    typeof window !== 'undefined' &&
    window.navigator.maxTouchPoints > 1
  ) {
    return 'ios'
  }
  if (/Android/.test(ua)) return 'android'
  if (/Mac/.test(platform)) return 'macos'
  if (/Win/.test(platform)) return 'windows'
  if (/Linux/.test(platform)) return 'linux'
  return 'unknown'
}

function detectBrowser(ua: string): Browser {
  // Order matters — UA strings often contain multiple brand names.
  if (/EdgiOS|EdgA|Edg\//.test(ua)) return 'edge'
  if (/SamsungBrowser/.test(ua)) return 'samsung'
  if (/OPR\/|Opera/.test(ua)) return 'opera'
  if (/FxiOS|Firefox/.test(ua)) return 'firefox'
  if (/CriOS|Chrome/.test(ua)) return 'chrome'
  // Safari must come last — every webkit-based browser includes "Safari"
  // in its UA.
  if (/Safari/.test(ua)) return 'safari'
  return 'other'
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS Safari uses the legacy navigator.standalone flag.
  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  // Android / desktop use display-mode media queries.
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  return false
}
