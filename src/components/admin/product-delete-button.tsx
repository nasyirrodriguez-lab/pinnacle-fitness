'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteProduct } from '@/app/admin/catalog/actions'

interface Props {
  kind: 'plan' | 'pass'
  id: string
  name: string
}

// Two-tap delete. Products with sales history get retired (hidden
// everywhere, kept for records) instead of hard-deleted.
export default function ProductDeleteButton({ kind, id, name }: Props) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const run = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteProduct({ kind, id })
      if (!result.ok) {
        setError(result.error)
        setArmed(false)
        return
      }
      if (result.outcome === 'retired') {
        setNotice(
          `${name} has sales history so it can't be fully deleted — it's now retired: off the website and off sale everywhere.`
        )
        setArmed(false)
        router.refresh()
        return
      }
      router.push('/admin/catalog')
    })
  }

  if (notice) {
    return <p className="text-sm text-turquoise-700 mt-6">{notice}</p>
  }

  return (
    <div className="mt-6 flex items-center gap-3">
      {!armed ? (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-red-700"
        >
          <Trash2 size={14} />
          Delete this {kind}…
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={isPending}
            onClick={run}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-red-50 border border-red-300 text-red-700 disabled:opacity-50"
          >
            <Trash2 size={14} />
            {isPending ? 'Deleting…' : `Yes, delete "${name}"`}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setArmed(false)}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            Cancel
          </button>
        </>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  )
}
