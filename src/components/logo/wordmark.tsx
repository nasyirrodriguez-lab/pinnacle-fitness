import { cn } from '@/lib/utils'
import Icon from './icon'

interface WordmarkProps {
  width?: number
  className?: string
  variant?: 'wordmark' | 'icon' | 'stacked'
}

// Text wordmark until the real logo file lands. `width` is honoured as an
// approximate visual width so existing call sites keep their sizing.
export default function Wordmark({
  width = 160,
  className,
  variant = 'wordmark',
}: WordmarkProps) {
  if (variant === 'icon') {
    return <Icon size={Math.round(width * 0.25)} className={className} />
  }
  const scale = width / 160
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 select-none text-current',
        className
      )}
      style={{ fontSize: `${scale}rem` }}
      aria-label="Pinnacle Fitness"
    >
      <Icon size={Math.round(26 * scale)} className="shrink-0" />
      <span
        className={cn(
          'flex leading-none',
          variant === 'stacked' ? 'flex-col items-start' : 'items-baseline gap-1.5'
        )}
      >
        <span
          className="font-heading text-[1.25em] font-black uppercase tracking-[-0.02em]"
          style={{ fontVariationSettings: "'wdth' 118" }}
        >
          Pinnacle
        </span>
        <span
          className="font-heading text-[0.5em] font-semibold uppercase tracking-[0.22em] opacity-70"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Fitness
        </span>
      </span>
    </span>
  )
}
