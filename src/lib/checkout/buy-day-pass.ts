'use client'

// Client-side helper to start a day pass purchase from anywhere in the app.
// Handles the auth gate: signed-out users get sent to /sign-in with a `next`
// that brings them back to this same page with ?buy=day-pass, which the
// home page picks up and re-triggers the purchase.

interface BuyDayPassArgs {
  signedIn: boolean
  passId?: string
  returnPath?: string
  discountCode?: string
  payAtDesk?: boolean
}

export async function startDayPassPurchase(
  args: BuyDayPassArgs
): Promise<{ ok: true; payAtDesk?: boolean } | { ok: false; error: string }> {
  const passId = args.passId ?? 'day-pass'
  const returnPath = args.returnPath ?? '/'

  if (!args.signedIn) {
    const next = `${returnPath}${returnPath.includes('?') ? '&' : '?'}buy=${passId}`
    window.location.href = `/sign-in?next=${encodeURIComponent(next)}`
    return { ok: true }
  }

  try {
    const res = await fetch('/api/checkout/pass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passId,
        ...(args.discountCode ? { discountCode: args.discountCode } : {}),
        ...(args.payAtDesk ? { payAtDesk: true } : {}),
      }),
    })
    const body = (await res.json().catch(() => ({}))) as {
      checkoutUrl?: string
      payAtDesk?: boolean
      error?: string
    }
    if (!res.ok || (!body.checkoutUrl && !body.payAtDesk)) {
      return { ok: false, error: body.error ?? 'Could not start payment' }
    }
    if (body.payAtDesk) {
      return { ok: true, payAtDesk: true }
    }
    window.location.href = body.checkoutUrl as string
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Payment failed to start',
    }
  }
}
