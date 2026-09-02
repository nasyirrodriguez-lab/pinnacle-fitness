import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import InquiryForm from '@/components/inquiry-form/inquiry-form'

type InquiryModalProps = {
  isOpen: boolean
  onClose: () => void
  defaultInterests?: string[]
}

export default function InquiryModal({
  isOpen,
  onClose,
  defaultInterests,
}: InquiryModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">
            Get in Touch
          </DialogTitle>
          <DialogDescription>
            Tell us what you&apos;re looking for and we&apos;ll get back to you.
          </DialogDescription>
        </DialogHeader>
        <InquiryForm defaultInterests={defaultInterests} />
      </DialogContent>
    </Dialog>
  )
}
