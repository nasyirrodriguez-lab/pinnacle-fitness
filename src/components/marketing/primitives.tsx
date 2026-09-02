import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('py-20 md:py-28 scroll-mt-20', className)}>
      <div className="max-w-6xl mx-auto px-6 md:px-10">{children}</div>
    </section>
  )
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-primary mb-4">
      {children}
    </p>
  )
}

export function Display({
  children,
  as: Tag = 'h2',
  className,
}: {
  children: React.ReactNode
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}) {
  return (
    <Tag
      className={cn(
        'font-heading font-black uppercase leading-[0.92] tracking-tight text-balance',
        Tag === 'h1'
          ? 'text-5xl sm:text-7xl md:text-8xl'
          : Tag === 'h2'
            ? 'text-3xl sm:text-5xl'
            : 'text-xl sm:text-2xl',
        className
      )}
    >
      {children}
    </Tag>
  )
}

export function Stat({
  value,
  label,
  className,
}: {
  value: React.ReactNode
  label: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="font-stat text-5xl sm:text-6xl leading-none text-primary">
        {value}
      </div>
      <div className="mt-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
        {label}
      </div>
    </div>
  )
}

type PillProps = {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'outline' | 'ghost'
  className?: string
  external?: boolean
}

export function Pill({
  href,
  children,
  variant = 'primary',
  className,
  external,
}: PillProps) {
  const cls = cn(
    'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors',
    variant === 'primary' &&
      'bg-primary text-primary-foreground hover:brightness-110',
    variant === 'outline' &&
      'border border-foreground/80 text-foreground hover:bg-foreground hover:text-background',
    variant === 'ghost' &&
      'border border-border text-muted-foreground hover:text-foreground',
    className
  )
  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  )
}

// Where a real photo goes once the gym sends one. Until then a bronze
// block with the mark, so layouts don't depend on stock imagery.
export function PhotoSlot({
  src,
  alt,
  className,
  priority,
}: {
  src?: string | null
  alt: string
  className?: string
  priority?: boolean
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[22px] bg-card border border-border',
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <Mark className="w-1/3 max-w-40 text-primary/40" />
        </div>
      )}
    </div>
  )
}

// The mountain-and-flag from the Pinnacle logo, simplified.
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 96 L60 22 L112 96 Z" fill="currentColor" />
      <path d="M60 22 L60 4" stroke="currentColor" strokeWidth="4" />
      <path d="M60 4 L86 12 L60 22 Z" fill="currentColor" />
      <path
        d="M44 96 L60 60 L76 96 Z"
        fill="currentColor"
        className="opacity-40"
      />
    </svg>
  )
}

export const GYM = {
  name: 'Pinnacle Fitness',
  venue: 'The Playground — Sport & Social',
  address: '227 Western Main Rd, Port of Spain',
  email: 'hello@pinnaclefitness.app',
  coaches: [
    { name: 'Nasyir Rodriguez', phone: '688-6887', wa: '18686886887' },
    { name: 'Matthew Sirjoo', phone: '724-5734', wa: '18687245734' },
  ],
  hours: [
    { days: 'Monday – Friday', time: '5:30 AM – 7:00 PM' },
    { days: 'Saturday', time: '7:00 AM – 1:00 PM' },
    { days: 'Sunday', time: 'Closed' },
  ],
  floorCap: 20,
  groupCap: 6,
}
