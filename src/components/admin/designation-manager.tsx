'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Pencil, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  adminCreateDesignationRole,
  adminRenameDesignationRole,
  adminDeleteDesignationRole,
  adminAssignDesignation,
  adminClearDesignation,
} from '@/app/admin/members/designations/actions'

export interface RoleMember {
  id: string
  name: string
  email: string
}

export interface RoleWithMembers {
  id: string
  label: string
  members: RoleMember[]
}

interface Props {
  roles: RoleWithMembers[]
}

// One card per designation tier: rename it, delete it (when empty),
// add people by email, remove them with a tap. New tiers at the top.
export default function DesignationManager({ roles }: Props) {
  const router = useRouter()
  const [newLabel, setNewLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        setError(result.error ?? 'Something went wrong')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const label = newLabel.trim()
          if (!label) return
          run(() => adminCreateDesignationRole({ label }))
          setNewLabel('')
        }}
        className="bg-white border border-neutral-200 rounded-lg p-4 flex flex-wrap items-center gap-2"
      >
        <Input
          placeholder="New role name, e.g. Resident Mentor"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          disabled={isPending}
          maxLength={60}
          className="flex-1 min-w-52"
        />
        <Button type="submit" disabled={isPending || !newLabel.trim()}>
          <Plus size={15} className="mr-1" />
          Create role
        </Button>
      </form>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {roles.map((role) => (
        <RoleCard key={role.id} role={role} run={run} isPending={isPending} />
      ))}
    </div>
  )
}

function RoleCard({
  role,
  run,
  isPending,
}: {
  role: RoleWithMembers
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void
  isPending: boolean
}) {
  const [renaming, setRenaming] = useState(false)
  const [label, setLabel] = useState(role.label)
  const [addEmail, setAddEmail] = useState('')

  return (
    <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center gap-2">
        {renaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              run(() => adminRenameDesignationRole({ id: role.id, label }))
              setRenaming(false)
            }}
            className="flex items-center gap-2 flex-1"
          >
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isPending}
              maxLength={60}
              className="h-8 max-w-64"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={isPending}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setLabel(role.label)
                setRenaming(false)
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <h2 className="font-heading text-lg flex-1">
              {role.label}
              <span className="ml-2 text-xs font-sans font-normal text-neutral-500">
                {role.members.length}{' '}
                {role.members.length === 1 ? 'person' : 'people'} · free
                check-in
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="p-1.5 text-neutral-400 hover:text-neutral-900"
              aria-label={`Rename ${role.label}`}
            >
              <Pencil size={15} />
            </button>
            {role.members.length === 0 && (
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(() => adminDeleteDesignationRole({ id: role.id }))
                }
                className="p-1.5 text-neutral-400 hover:text-red-700"
                aria-label={`Delete ${role.label}`}
              >
                <Trash2 size={15} />
              </button>
            )}
          </>
        )}
      </div>

      <div className="p-5 space-y-3">
        {role.members.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {role.members.map((m) => (
              <li
                key={m.id}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-neutral-100 text-sm"
              >
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-neutral-500">{m.email}</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    run(() => adminClearDesignation({ userId: m.id }))
                  }
                  className="p-1 rounded-full text-neutral-400 hover:text-red-700 hover:bg-neutral-200"
                  aria-label={`Remove ${m.name} from ${role.label}`}
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const email = addEmail.trim()
            if (!email) return
            run(() => adminAssignDesignation({ email, roleId: role.id }))
            setAddEmail('')
          }}
          className="flex items-center gap-2"
        >
          <Input
            type="email"
            placeholder="Add by member email…"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            disabled={isPending}
            className="h-9 max-w-72"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={isPending || !addEmail.trim()}
          >
            <UserPlus size={14} className="mr-1" />
            Add
          </Button>
        </form>
      </div>
    </section>
  )
}
