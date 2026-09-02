import { cn } from '@/lib/utils'

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number
}

// Pinnacle mark: a peak with a flag planted on it. Placeholder geometry
// until the real logo file arrives — keep the API stable.
export default function Icon({ size = 32, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('inline-block', className)}
      aria-hidden="true"
      {...props}
    >
      <path
        fill="currentColor"
        d="M32 14 6 56h52L32 14Zm0 12.5L47 50H17l15-23.5Z"
      />
      <path fill="currentColor" d="M31 4h2v14h-2z" />
      <path fill="currentColor" d="M33 5h13l-4 4 4 4H33z" />
    </svg>
  )
}
