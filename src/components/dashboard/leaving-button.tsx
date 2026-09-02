'use client'

import { useState, useTransition } from 'react'

// "Leaving" from your own phone: closes the open visit so the floor count
// stays honest without a trip back to the iPad.
export default function LeavingButton() {
  const [state, setState] = useState<'idle' | 'done' | 'none' | 'error'>('idle')
  const [isPending, startTransition] = useTransition()

  if (state === 'done') {
    return <p className="text-sm text-turf">Signed out — see you next time.</p>
  }
  if (state === 'none') {
    return <p className="text-sm text-ice-mute">You’re not checked in right now.</p>
  }
  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              const res = await fetch('/api/checkin/phone-checkout', {
                method: 'POST',
              })
              if (res.status === 404) setState('none')
              else if (res.ok) setState('done')
              else setState('error')
            } catch {
              setState('error')
            }
          })
        }
        className="h-11 px-5 rounded-full border border-border text-ice-dim text-sm hover:border-ice hover:text-ice disabled:opacity-60"
      >
        {isPending ? 'Signing out…' : 'Leaving — sign me out'}
      </button>
      {state === 'error' && (
        <p className="text-xs text-bad mt-2">Couldn’t sign you out — try the iPad.</p>
      )}
    </div>
  )
}
