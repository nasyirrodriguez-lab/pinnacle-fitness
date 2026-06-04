'use client'

import { Toaster } from 'react-hot-toast'

export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-center"
      toastOptions={{
        duration: 3500,
        style: {
          background: '#FFFFFF',
          color: '#1C1A17',
          border: '1px solid #E8E3D9',
          borderRadius: '9999px',
          fontSize: '13px',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          padding: '10px 18px',
          boxShadow: '0 4px 16px rgba(28,26,23,0.08)',
        },
        success: {
          iconTheme: { primary: '#1F3D2B', secondary: '#fff' },
          style: { borderColor: '#1F3D2B30' },
        },
        error: {
          iconTheme: { primary: '#dc2626', secondary: '#fff' },
          style: { borderColor: '#dc262630' },
        },
      }}
    />
  )
}
