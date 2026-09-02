import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import SignUpForm from '@/components/sign-up-form/sign-up-form'

type SignUpModalProps = {
  isOpen: boolean
  onClose: () => void
}

export default function SignUpModal({ isOpen, onClose }: SignUpModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <div className="py-12 px-8">
          <SignUpForm />
        </div>
        <DialogFooter className="px-8">
          <Button size="sm" onClick={onClose} colorScheme="darkOrange">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
