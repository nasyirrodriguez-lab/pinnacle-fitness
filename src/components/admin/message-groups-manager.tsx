'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Trash2, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  adminCreateMessageGroup,
  adminDeleteMessageGroup,
  adminAddGroupMember,
  adminRemoveGroupMember,
} from '@/app/admin/notifications/actions'

export interface GroupMember {
  id: string
  name: string
  email: string
}

export interface MessageGroupWithMembers {
  id: string
  name: string
  members: GroupMember[]
}

interface Props {
  groups: MessageGroupWithMembers[]
}

export default function MessageGroupsManager({ groups }: Props) {
  const router = useRouter()
  const [newName, setNewName] = useState('')
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
    <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
        <Users size={18} className="text-turquoise-700" />
        <h2 className="font-heading text-lg">Groups</h2>
      </div>
      <div className="p-5 space-y-5">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const name = newName.trim()
            if (!name) return
            run(() => adminCreateMessageGroup({ name }))
            setNewName('')
          }}
          className="flex items-center gap-2"
        >
          <Input
            placeholder="New group, e.g. Virtual Office members"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={isPending}
            maxLength={80}
            className="max-w-80"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isPending || !newName.trim()}
          >
            <Plus size={14} className="mr-1" />
            Create
          </Button>
        </form>

        {error && <p className="text-sm text-red-700">{error}</p>}

        {groups.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No groups yet. Create one, add members, then pick it in the
            &ldquo;To&rdquo; dropdown when composing.
          </p>
        ) : (
          groups.map((g) => (
            <GroupRow key={g.id} group={g} run={run} isPending={isPending} />
          ))
        )}
      </div>
    </section>
  )
}

function GroupRow({
  group,
  run,
  isPending,
}: {
  group: MessageGroupWithMembers
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void
  isPending: boolean
}) {
  const [addEmail, setAddEmail] = useState('')

  return (
    <div className="border border-neutral-200 rounded-md p-4 space-y-3">
      <div className="flex items-center gap-2">
        <p className="font-medium text-sm flex-1">
          {group.name}
          <span className="ml-2 text-xs font-normal text-neutral-500">
            {group.members.length}{' '}
            {group.members.length === 1 ? 'member' : 'members'}
          </span>
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            run(() => adminDeleteMessageGroup({ groupId: group.id }))
          }
          className="p-1.5 text-neutral-400 hover:text-red-700"
          aria-label={`Delete group ${group.name}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {group.members.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {group.members.map((m) => (
            <li
              key={m.id}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-neutral-100 text-xs"
            >
              <span className="font-medium">{m.name}</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(() =>
                    adminRemoveGroupMember({
                      groupId: group.id,
                      userId: m.id,
                    })
                  )
                }
                className="p-0.5 rounded-full text-neutral-400 hover:text-red-700"
                aria-label={`Remove ${m.name} from ${group.name}`}
              >
                <X size={12} />
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
          run(() => adminAddGroupMember({ groupId: group.id, email }))
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
          className="h-8 max-w-64 text-sm"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={isPending || !addEmail.trim()}
        >
          <UserPlus size={13} className="mr-1" />
          Add
        </Button>
      </form>
    </div>
  )
}
