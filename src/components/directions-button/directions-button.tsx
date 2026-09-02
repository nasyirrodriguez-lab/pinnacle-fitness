import { MapPin } from 'lucide-react'
import { directionsUrl } from '@/config/location'
import { cn } from '@/lib/utils'

interface DirectionsButtonProps {
  variant?: 'solid' | 'subtle' | 'inline'
  label?: string
  className?: string
}

const VARIANT_CLASSES = {
  solid:
    'inline-flex items-center gap-2 px-4 py-2 rounded-md bg-turquoise-500 hover:bg-turquoise-600 text-white text-sm font-medium transition',
  subtle:
    'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-neutral-200 hover:bg-neutral-50 text-sm font-medium text-neutral-900 transition',
  inline:
    'inline-flex items-center gap-1 text-sm font-medium text-turquoise-500 hover:text-turquoise-400 transition',
}

export default function DirectionsButton({
  variant = 'solid',
  label = 'Get directions',
  className,
}: DirectionsButtonProps) {
  return (
    <a
      href={directionsUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(VARIANT_CLASSES[variant], className)}
    >
      <MapPin size={16} />
      {label}
    </a>
  )
}
