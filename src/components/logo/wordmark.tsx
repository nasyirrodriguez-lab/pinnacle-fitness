import { cn } from '@/lib/utils'

interface WordmarkProps {
  width?: number
  className?: string
  variant?: 'wordmark' | 'icon' | 'stacked'
  /** Set to true when the logo sits on a dark background so the PNG is inverted to white */
  dark?: boolean
}

export default function Wordmark({
  width = 160,
  className,
  dark = false,
}: WordmarkProps) {
  const height = Math.round(width * 0.28)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/pinnacle-logo-transparent.png"
      alt="Pinnacle Fitness"
      width={width}
      height={height}
      className={cn('select-none', className)}
      style={dark ? { filter: 'brightness(0) invert(1)' } : undefined}
    />
  )
}
