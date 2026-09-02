'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useModalContext } from '@/providers/modal-provider/modal-provider'

type ButtonProps = React.ComponentProps<typeof Button>

export function BookNow({
  label = 'Book Now',
  ...props
}: ButtonProps & { label?: string }) {
  return (
    <Link href="/buy">
      <Button size="default" {...props}>
        {label}
      </Button>
    </Link>
  )
}

export function ViewPricing(props: ButtonProps) {
  return (
    <Link href="/pricing">
      <Button variant="outline" size="default" {...props}>
        View Pricing
      </Button>
    </Link>
  )
}

export function Login(props: ButtonProps) {
  return (
    <Link
      href="https://theworxtt.spaces.nexudus.com/login?&v=latest"
      target="_blank"
      rel="noopener noreferrer"
    >
      <Button variant="outline" size="default" {...props}>
        Book Now
      </Button>
    </Link>
  )
}

export function Inquire({
  defaultInterests,
  ...props
}: ButtonProps & { defaultInterests?: string[] }) {
  const { openModal } = useModalContext()
  return (
    <Button
      size="default"
      onClick={() => openModal('INQUIRY_MODAL', { defaultInterests })}
      {...props}
    >
      Get in Touch
    </Button>
  )
}

export function CtaRow({
  includes,
  props,
}: {
  includes: Array<'sign-up-now' | 'view-pricing'>
  props?: {
    className?: string
    buttonProps?: ButtonProps
  }
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap justify-center lg:justify-start gap-2',
        props?.className
      )}
    >
      {includes.includes('sign-up-now') && (
        <div>
          <BookNow {...props?.buttonProps} />
        </div>
      )}
      {includes.includes('view-pricing') && (
        <div>
          <ViewPricing {...props?.buttonProps} />
        </div>
      )}
    </div>
  )
}
