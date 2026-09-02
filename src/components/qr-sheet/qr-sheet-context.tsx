'use client'

import { createContext, useCallback, useContext, useState } from 'react'

type Mode = 'show' | 'scan'

interface QrSheetState {
  open: boolean
  mode: Mode
}

interface QrSheetApi {
  state: QrSheetState
  openSheet: (mode?: Mode) => void
  closeSheet: () => void
  setMode: (mode: Mode) => void
}

const Ctx = createContext<QrSheetApi | null>(null)

export function QrSheetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QrSheetState>({
    open: false,
    mode: 'show',
  })

  const openSheet = useCallback((mode: Mode = 'show') => {
    setState({ open: true, mode })
  }, [])

  const closeSheet = useCallback(() => {
    setState((s) => ({ ...s, open: false }))
  }, [])

  const setMode = useCallback((mode: Mode) => {
    setState((s) => ({ ...s, mode }))
  }, [])

  return (
    <Ctx.Provider value={{ state, openSheet, closeSheet, setMode }}>
      {children}
    </Ctx.Provider>
  )
}

export function useQrSheet(): QrSheetApi {
  const v = useContext(Ctx)
  if (!v) {
    throw new Error('useQrSheet must be used within QrSheetProvider')
  }
  return v
}
