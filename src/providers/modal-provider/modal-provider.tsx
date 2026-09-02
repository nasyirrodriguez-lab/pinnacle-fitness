'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import SignUpModal from '@/components/sign-up-modal/sign-up-modal'
import InquiryModal from '@/components/inquiry-modal/inquiry-modal'

enum ModalTypes {
  SIGN_UP_MODAL = 'SIGN_UP_MODAL',
  INQUIRY_MODAL = 'INQUIRY_MODAL',
}

type ModalType = keyof typeof ModalTypes

type ModalData = Record<string, unknown>

type ModalProviderProps = {
  children: React.ReactNode
}

type OpenModal = (modalType: ModalType, data?: ModalData) => void
type CloseModal = (id: string) => void
type StoreEntry = {
  id: string
  type: ModalType
  data?: ModalData
}
type Store = StoreEntry[]

type Context = {
  openModal: OpenModal
  closeModal: CloseModal
  store: Store
}

const initialContext: Context = {
  openModal: () => {},
  closeModal: () => {},
  store: [],
}

const ModalContext = createContext(initialContext)

const ModalComponents: Record<
  ModalType,
  React.ComponentType<{
    isOpen: boolean
    onClose: () => void
    [key: string]: unknown
  }>
> = {
  [ModalTypes.SIGN_UP_MODAL]: SignUpModal,
  [ModalTypes.INQUIRY_MODAL]: InquiryModal,
}

function ModalProvider({ children }: ModalProviderProps) {
  const [store, setStore] = useState<Store>([])

  const openModal = useCallback<OpenModal>(
    (modalType: ModalType, data?: ModalData) => {
      setStore([
        ...store,
        {
          id: uuidv4(),
          type: modalType,
          data,
        },
      ])
    },
    [store]
  )

  const closeModal = useCallback<CloseModal>(
    (id: string) => {
      setStore(store.filter((m) => m.id !== id))
    },
    [store]
  )

  return (
    <ModalContext.Provider
      value={{
        openModal,
        closeModal,
        store: store,
      }}
    >
      {store.map((item) => {
        const { id, type, data } = item
        const Comp = ModalComponents[type]
        return (
          <Comp
            key={id}
            isOpen={true}
            onClose={() => {
              closeModal(id)
            }}
            {...data}
          />
        )
      })}
      {children}
    </ModalContext.Provider>
  )
}

export const useModalContext = () => useContext(ModalContext)

export default ModalProvider
