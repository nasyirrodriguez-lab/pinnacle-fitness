'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const onClick = async () => {
    setPending(true)
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' })
      router.push('/sign-in')
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <Button variant="outline" onClick={onClick} disabled={pending}>
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  )
}
