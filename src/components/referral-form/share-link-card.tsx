'use client'

import { useState } from 'react'
import { Copy, Check, Share2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  code: string
  shareUrl: string
}

const SHARE_TEXT_TEMPLATE = (url: string) =>
  `Come check out Pinnacle Fitness with me — our gym in Port of Spain. Sign up through my link and we both get a free day pass: ${url}`

export default function ShareLinkCard({ code, shareUrl }: Props) {
  const [copied, setCopied] = useState(false)
  const text = SHARE_TEXT_TEMPLATE(shareUrl)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const nativeShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) {
      void copy()
      return
    }
    try {
      await navigator.share({
        title: 'Pinnacle Fitness',
        text,
        url: shareUrl,
      })
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="bg-white border-2 border-turquoise-500 rounded-lg p-6">
      <p className="text-xs uppercase tracking-wide text-turquoise-700 font-medium mb-1">
        Your personal link
      </p>
      <p className="font-heading text-2xl mb-1">{code}</p>
      <p className="text-sm text-neutral-600 mb-4">
        Anyone who signs up through this link is attributed to you.
      </p>

      <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2 mb-4">
        <code className="text-sm text-neutral-900 truncate flex-1">
          {shareUrl}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-neutral-200 hover:bg-neutral-100"
        >
          {copied ? (
            <>
              <Check size={12} />
              Copied
            </>
          ) : (
            <>
              <Copy size={12} />
              Copy
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={nativeShare}>
          <Share2 size={16} className="mr-2" />
          Share
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-neutral-200 text-sm font-medium hover:bg-neutral-50"
        >
          <MessageCircle size={16} />
          WhatsApp
        </a>
      </div>
    </div>
  )
}
