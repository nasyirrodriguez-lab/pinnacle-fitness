'use client'

import { useState } from 'react'

const numbers = [
  { label: 'Nasyir: 688-6887', href: 'https://wa.me/18686886887' },
  { label: 'Matthew: 724-5734', href: 'https://wa.me/18687245734' },
]

export default function WhatsAppButton() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Popup */}
      {open && (
        <div className="mb-1 rounded-2xl bg-[#3A3733] p-3 shadow-xl">
          <p className="mb-2 px-1 text-xs font-medium text-white/60 uppercase tracking-wider">Chat with us</p>
          <div className="flex flex-col gap-1.5">
            {numbers.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: '#25D366' }}>
                  <svg viewBox="0 0 32 32" className="h-3.5 w-3.5" fill="white">
                    <path d="M16 .8C7.6.8.8 7.6.8 16c0 2.7.7 5.2 1.9 7.4L.8 31.2l8.1-2.1A15.2 15.2 0 0016 31.2C24.4 31.2 31.2 24.4 31.2 16S24.4.8 16 .8zm7 18.4c-.4-.2-2.3-1.1-2.6-1.2-.4-.1-.6-.2-.9.2s-1 1.2-1.3 1.5c-.2.3-.5.3-.9.1-.4-.2-1.6-.6-3-1.8-1.1-1-1.8-2.2-2.1-2.6-.2-.4 0-.6.2-.8l.6-.7c.2-.2.3-.4.4-.7.1-.2 0-.5-.1-.7-.1-.2-.9-2.1-1.2-2.9-.3-.8-.6-.7-.9-.7h-.7c-.3 0-.7.1-1 .5-.4.4-1.4 1.3-1.4 3.2s1.4 3.7 1.6 4c.2.2 2.8 4.2 6.7 5.9.9.4 1.7.6 2.2.8.9.3 1.8.2 2.4.1.7-.1 2.3-.9 2.6-1.8.3-.9.3-1.7.2-1.8-.1-.2-.4-.3-.8-.5z" />
                  </svg>
                </span>
                {label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Main button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Chat with us on WhatsApp"
        className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110"
        style={{ backgroundColor: '#25D366' }}
      >
        {open ? (
          <svg className="h-6 w-6" fill="white" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth={2.5} strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 32 32" className="h-7 w-7" fill="white">
            <path d="M16 .8C7.6.8.8 7.6.8 16c0 2.7.7 5.2 1.9 7.4L.8 31.2l8.1-2.1A15.2 15.2 0 0016 31.2C24.4 31.2 31.2 24.4 31.2 16S24.4.8 16 .8zm0 27.8c-2.5 0-4.8-.7-6.8-1.8l-.5-.3-5 1.3 1.3-4.8-.3-.5A12.7 12.7 0 013.3 16C3.3 9.1 9.1 3.3 16 3.3S28.7 9.1 28.7 16 22.9 28.6 16 28.6zm7-9.4c-.4-.2-2.3-1.1-2.6-1.2-.4-.1-.6-.2-.9.2s-1 1.2-1.3 1.5c-.2.3-.5.3-.9.1-.4-.2-1.6-.6-3-1.8-1.1-1-1.8-2.2-2.1-2.6-.2-.4 0-.6.2-.8l.6-.7c.2-.2.3-.4.4-.7.1-.2 0-.5-.1-.7-.1-.2-.9-2.1-1.2-2.9-.3-.8-.6-.7-.9-.7h-.7c-.3 0-.7.1-1 .5-.4.4-1.4 1.3-1.4 3.2s1.4 3.7 1.6 4c.2.2 2.8 4.2 6.7 5.9.9.4 1.7.6 2.2.8.9.3 1.8.2 2.4.1.7-.1 2.3-.9 2.6-1.8.3-.9.3-1.7.2-1.8-.1-.2-.4-.3-.8-.5z" />
          </svg>
        )}
      </button>
    </div>
  )
}
