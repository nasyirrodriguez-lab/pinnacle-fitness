'use client'

import ModalProvider from '@/providers/modal-provider/modal-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return <ModalProvider>{children}</ModalProvider>
}
