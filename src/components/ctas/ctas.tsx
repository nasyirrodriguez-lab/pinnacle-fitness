'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useModalContext } from '@/providers/modal-provider/modal-provider'

type ButtonProps = React.ComponentProps<typeof Button>

export function ApplyNow({
  label = 'Apply to join',
  ...props
}: ButtonProps & { label?: string }) {
  return (
    <Link href="/apply">
      <Button size="default" {...props}>
        {label}
      </Button>
    </Link>
  )
}

// Kept for call sites that still import BookNow — members book from the
// app, applicants apply.
export const BookNow = ApplyNow

export function ViewPricing(props: ButtonProps) {
  return (
    <Link href="/pricing">
      <Button variant="outline" size="default" {...props}>
        See memberships
      </Button>
    </Link>
  )
}

export function Login(props: ButtonProps) {
  return (
    <Link href="/sign-in">
      <Button variant="outline" size="default" {...props}>
        Sign in
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
      Get in touch
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
          <ApplyNow {...props?.buttonProps} />
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
