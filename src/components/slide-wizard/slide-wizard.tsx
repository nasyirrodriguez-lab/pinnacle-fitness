'use client'

interface Props {
  step: number
  direction?: 'forward' | 'back'
  children: React.ReactNode[]
}

// Renders only the active step, reanimating it with a CSS keyframe each
// time `step` changes (the `key` causes React to remount the slide).
// Direction is owned by the parent so this stays render-only — no state,
// no effects.
export default function SlideWizard({
  step,
  direction = 'forward',
  children,
}: Props) {
  const total = children.length
  const safeStep = Math.max(0, Math.min(step, total - 1))
  const slideClass =
    direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'

  return (
    <div className="relative overflow-hidden">
      <div key={safeStep} className={slideClass}>
        {children[safeStep]}
      </div>
    </div>
  )
}
