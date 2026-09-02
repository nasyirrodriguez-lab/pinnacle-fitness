import { cn } from '@/lib/utils'

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number
}

export default function Icon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 300 300"
      width={size}
      height={size}
      className={cn('inline-block', className)}
      {...props}
    >
      <path
        fill="currentColor"
        d="M290 76.68 241.47 27.8l-56.43 56.07V27.79h-70.08v56.07L58.88 27.79 10 76.68 83.68 150 10 223.32l48.88 48.88 56.07-56.07v56.07h70.09v-56.07l56.43 56.07L290 223.32l-73.33-73.33L290 76.67ZM149.45 201.42l-49.61-50.35 49.61-49.61 50.35 49.61-50.35 50.35Z"
      />
    </svg>
  )
}
