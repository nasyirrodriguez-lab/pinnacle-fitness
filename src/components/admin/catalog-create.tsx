'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createProduct } from '@/app/admin/catalog/actions'

// Tiny create flow: pick plan or pass, give it an id + name, land on
// the full edit page. New products start inactive with price 0 so
// nothing half-configured ever shows on the public site.
export default function CatalogCreate() {
  const router = useRouter()
  const [open, setOpen] = useState<'plan' | 'pass' | null>(null)
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const start = (kind: 'plan' | 'pass') => {
    setOpen(open === kind ? null : kind)
    setError(null)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!open) return
    setError(null)
    startTransition(async () => {
      const result = await createProduct({
        kind: open,
        id: id.trim(),
        name: name.trim(),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(result.href)
    })
  }

  // Auto-fill the slug from the name until the admin edits it by hand.
  const onNameChange = (value: string) => {
    if (!id || id === slugify(name)) setId(slugify(value))
    setName(value)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={open === 'plan' ? 'default' : 'outline'}
          onClick={() => start('plan')}
        >
          <Plus size={14} className="mr-1" />
          New plan
        </Button>
        <Button
          type="button"
          size="sm"
          variant={open === 'pass' ? 'default' : 'outline'}
          onClick={() => start('pass')}
        >
          <Plus size={14} className="mr-1" />
          New pass
        </Button>
      </div>
      {open && (
        <form
          onSubmit={submit}
          className="flex flex-wrap items-start gap-2 bg-white border border-neutral-200 rounded-md p-3"
        >
          <div className="flex-1 min-w-40">
            <Input
              placeholder={open === 'plan' ? 'Plan name' : 'Pass name'}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              disabled={isPending}
              maxLength={120}
            />
          </div>
          <div className="flex-1 min-w-40">
            <Input
              placeholder="id (e.g. team-day-pass)"
              value={id}
              onChange={(e) => setId(e.target.value)}
              disabled={isPending}
              maxLength={60}
              className="font-mono text-sm"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={isPending || !name.trim() || !id.trim()}
          >
            {isPending ? 'Creating…' : 'Create & edit'}
          </Button>
          {error && <p className="w-full text-xs text-red-700 mt-1">{error}</p>}
        </form>
      )}
    </div>
  )
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
