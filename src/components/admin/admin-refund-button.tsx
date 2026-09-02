'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { adminMarkRefunded } from '@/app/admin/payments/actions'

interface Props {
  paymentId: string
  amountLabel: string
  wamPaymentId?: string | null
}

export default function AdminRefundButton({
  paymentId,
  amountLabel,
  wamPaymentId,
}: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onConfirm = () => {
    setError(null)
    startTransition(async () => {
      const result = await adminMarkRefunded({ paymentId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Mark refunded
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark payment refunded?</DialogTitle>
          <DialogDescription>
            This updates our records for the {amountLabel} payment to{' '}
            <strong>refunded</strong>.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertDescription className="text-sm">
            <strong>Important:</strong> this does NOT issue the refund. You must
            process the refund in the Wam dashboard
            {wamPaymentId ? (
              <>
                {' '}
                for transaction{' '}
                <code className="text-xs break-all">{wamPaymentId}</code>
              </>
            ) : null}{' '}
            first, then come back here to reconcile our records.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Saving…' : "I've refunded in Wam — mark it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
