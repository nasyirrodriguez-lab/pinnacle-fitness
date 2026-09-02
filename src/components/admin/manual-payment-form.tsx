'use client'

import { useState, useTransition } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { recordManualPayment } from '@/app/admin/payments/new/actions'

interface MemberOption {
  id: string
  label: string
}
interface PassOption {
  id: string
  name: string
  priceCents: number
}
interface PlanOption {
  id: string
  name: string
  priceCents: number
}

type ProductKind = 'pass' | 'subscription' | 'one_time'
type PaymentMethod = 'cash' | 'wam_pos' | 'bank_transfer' | 'other'

interface FormValues {
  userId: string
  amountTtd: string
  paymentMethod: PaymentMethod
  externalRef: string
  discountCode: string
  note: string
  productKind: ProductKind
  passId: string
  planId: string
  description: string
  checkInNow: boolean
  applyCredit: boolean
}

interface Props {
  members: MemberOption[]
  passes: PassOption[]
  plans: PlanOption[]
  creditBalances?: Record<string, number>
  defaultUserId?: string
  defaultExternalRef?: string
  defaultAmountTtd?: string
}

function fmtTtd(cents: number): string {
  return `TTD $${(cents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

export default function ManualPaymentForm({
  members,
  passes,
  plans,
  creditBalances = {},
  defaultUserId,
  defaultExternalRef,
  defaultAmountTtd,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [paidAtLocal, setPaidAtLocal] = useState('')
  const [isPending, startTransition] = useTransition()
  const [memberQuery, setMemberQuery] = useState('')

  const { register, handleSubmit, setValue, getValues, control } =
    useForm<FormValues>({
      defaultValues: {
        userId: defaultUserId ?? '',
        amountTtd: defaultAmountTtd ?? '',
        paymentMethod: 'cash',
        externalRef: defaultExternalRef ?? '',
        discountCode: '',
        note: '',
        productKind: 'pass',
        passId: passes[0]?.id ?? '',
        planId: plans[0]?.id ?? '',
        description: '',
        checkInNow: true,
        applyCredit: false,
      },
    })

  const productKind = useWatch({ control, name: 'productKind' })
  const passId = useWatch({ control, name: 'passId' })
  const planId = useWatch({ control, name: 'planId' })
  const paymentMethod = useWatch({ control, name: 'paymentMethod' })
  const userId = useWatch({ control, name: 'userId' })
  const amountTtd = useWatch({ control, name: 'amountTtd' })
  const applyCredit = useWatch({ control, name: 'applyCredit' })

  const memberCreditCents = userId ? (creditBalances[userId] ?? 0) : 0
  const grossCents = (() => {
    const raw = (amountTtd ?? '').trim()
    if (raw === '') return 0
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.round(n * 100)
  })()
  const willApplyCents =
    applyCredit && memberCreditCents > 0
      ? Math.min(memberCreditCents, grossCents)
      : 0
  const memberOwesCents = grossCents - willApplyCents

  // Pre-fill amount when the admin picks a product — they can override.
  const onPickPass = (id: string) => {
    setValue('passId', id)
    const pass = passes.find((p) => p.id === id)
    if (pass && !getValues('amountTtd')) {
      setValue('amountTtd', String(Math.round(pass.priceCents / 100)))
    }
  }
  const onPickPlan = (id: string) => {
    setValue('planId', id)
    const plan = plans.find((p) => p.id === id)
    if (plan && !getValues('amountTtd')) {
      setValue('amountTtd', String(Math.round(plan.priceCents / 100)))
    }
  }

  const filteredMembers = memberQuery.trim()
    ? members.filter((m) =>
        m.label.toLowerCase().includes(memberQuery.toLowerCase())
      )
    : members
  const selectedMember = members.find((m) => m.id === userId)

  const onSubmit = (values: FormValues) => {
    setError(null)
    // Allow blank → treat as 0 so admins can comp a pass without typing
    // a literal '0' every time.
    const raw = values.amountTtd.trim()
    const amountCents = raw === '' ? 0 : Math.round(Number(raw) * 100)
    if (!Number.isFinite(amountCents) || amountCents < 0) {
      setError('Enter a valid amount (or leave blank for a free grant).')
      return
    }
    if (!values.userId) {
      setError('Pick the member or walk-in this payment is for.')
      return
    }

    let product:
      | { kind: 'pass'; passId: string }
      | { kind: 'subscription'; planId: string }
      | { kind: 'one_time'; description: string }
    if (values.productKind === 'pass') {
      if (!values.passId) {
        setError('Pick which pass was purchased.')
        return
      }
      product = { kind: 'pass', passId: values.passId }
    } else if (values.productKind === 'subscription') {
      if (!values.planId) {
        setError('Pick which plan was purchased.')
        return
      }
      product = { kind: 'subscription', planId: values.planId }
    } else {
      if (!values.description.trim()) {
        setError('Add a short description of what this payment covers.')
        return
      }
      product = { kind: 'one_time', description: values.description.trim() }
    }

    startTransition(async () => {
      const result = await recordManualPayment({
        userId: values.userId,
        amountCents: String(amountCents),
        paymentMethod: values.paymentMethod,
        externalRef: values.externalRef.trim() || undefined,
        discountCode: values.discountCode.trim() || undefined,
        paidAt: paidAtLocal ? new Date(paidAtLocal).toISOString() : undefined,
        note: values.note.trim() || undefined,
        product,
        checkInNow: values.checkInNow,
        applyCredit: values.applyCredit,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      // Server action redirects on success — we won't reach here.
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <Label>Member</Label>
        <Input
          placeholder="Search by name or email"
          value={memberQuery}
          onChange={(e) => setMemberQuery(e.target.value)}
          className="mb-2"
        />
        <div className="max-h-48 overflow-y-auto border border-neutral-200 rounded-md divide-y divide-neutral-100">
          {filteredMembers.slice(0, 50).map((m) => (
            <label
              key={m.id}
              className={
                userId === m.id
                  ? 'flex items-center gap-2 px-3 py-2 bg-turquoise-50 cursor-pointer'
                  : 'flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 cursor-pointer'
              }
            >
              <input
                type="radio"
                value={m.id}
                {...register('userId')}
                className="shrink-0"
              />
              <span className="text-sm truncate">{m.label}</span>
            </label>
          ))}
          {filteredMembers.length === 0 && (
            <p className="px-3 py-3 text-sm text-neutral-500">
              No members match.
            </p>
          )}
        </div>
        {selectedMember && (
          <p className="text-xs text-neutral-500 mt-1">
            Selected: <strong>{selectedMember.label}</strong>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="paymentMethod">Payment method</Label>
          <Controller
            control={control}
            name="paymentMethod"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => field.onChange(v as PaymentMethod)}
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="wam_pos">
                    Wam POS (card tap at front desk)
                  </SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div>
          <Label htmlFor="amountTtd">Amount (TTD)</Label>
          <Input
            id="amountTtd"
            inputMode="decimal"
            placeholder="e.g. 50"
            {...register('amountTtd', { required: true })}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Pre-filled from product when you pick one.
          </p>
        </div>
      </div>

      {memberCreditCents > 0 && (
        <div className="border border-lime-200 bg-lime-50 rounded-md p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              {...register('applyCredit')}
            />
            <span className="flex-1 text-sm">
              <span className="block font-medium">
                Apply this member&apos;s TTD $
                {(memberCreditCents / 100).toLocaleString('en-US')} account
                credit
              </span>
              {applyCredit && grossCents > 0 ? (
                <span className="block text-xs text-neutral-700 mt-1">
                  Gross: TTD ${(grossCents / 100).toLocaleString('en-US')} ·
                  Credit applied:{' '}
                  <strong>
                    TTD ${(willApplyCents / 100).toLocaleString('en-US')}
                  </strong>{' '}
                  · Member owes:{' '}
                  <strong>
                    TTD ${(memberOwesCents / 100).toLocaleString('en-US')}
                  </strong>
                </span>
              ) : (
                <span className="block text-xs text-neutral-600 mt-0.5">
                  Treats the amount above as the gross price. The recorded
                  payment will reflect what the member actually paid after
                  credit.
                </span>
              )}
            </span>
          </label>
        </div>
      )}

      <div>
        <Label htmlFor="paidAtLocal">When was this paid? (optional)</Label>
        <Input
          id="paidAtLocal"
          type="datetime-local"
          value={paidAtLocal}
          onChange={(e) => setPaidAtLocal(e.target.value)}
        />
        <p className="text-xs text-neutral-500 mt-1">
          Leave blank for right now. Set a past date to backfill a payment that
          happened earlier.
        </p>
      </div>

      <div>
        <Label htmlFor="discountCode">Discount code (optional)</Label>
        <Input
          id="discountCode"
          placeholder="e.g. FULLBLOOM10"
          className="uppercase"
          {...register('discountCode')}
        />
        <p className="text-xs text-neutral-500 mt-1">
          Applied to the amount above for plans and passes — the recorded
          payment shows the discounted figure.
        </p>
      </div>

      {paymentMethod === 'wam_pos' && (
        <div>
          <Label htmlFor="externalRef">Wam reference ID</Label>
          <Input
            id="externalRef"
            placeholder="e.g. 7792104800646399603862"
            {...register('externalRef')}
          />
          <p className="text-xs text-neutral-500 mt-1">
            From your Wam business interface. We block duplicates so the same
            auth code can&apos;t be recorded twice.
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="productKind">What was bought</Label>
        <Controller
          control={control}
          name="productKind"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v as ProductKind)
                setValue('amountTtd', '')
              }}
            >
              <SelectTrigger id="productKind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pass">A pass (day, 5-day, etc)</SelectItem>
                <SelectItem value="subscription">A monthly plan</SelectItem>
                <SelectItem value="one_time">Other (no auto-grant)</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {productKind === 'pass' && (
        <div>
          <Label>Pass</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {passes.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => onPickPass(p.id)}
                className={
                  passId === p.id
                    ? 'text-left border-2 border-turquoise-500 rounded-md p-3 bg-turquoise-50'
                    : 'text-left border border-neutral-200 rounded-md p-3 hover:border-turquoise-400'
                }
              >
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-neutral-500">
                  {fmtTtd(p.priceCents)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {productKind === 'subscription' && (
        <div>
          <Label>Plan</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {plans.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => onPickPlan(p.id)}
                className={
                  planId === p.id
                    ? 'text-left border-2 border-turquoise-500 rounded-md p-3 bg-turquoise-50'
                    : 'text-left border border-neutral-200 rounded-md p-3 hover:border-turquoise-400'
                }
              >
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-neutral-500">
                  {fmtTtd(p.priceCents)} / month
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {productKind === 'one_time' && (
        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            placeholder="e.g. Event space deposit"
            {...register('description')}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Recorded as a payment on the member&apos;s account but no pass or
            plan is granted automatically.
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="note">Internal note (optional)</Label>
        <Textarea
          id="note"
          rows={2}
          placeholder="Anything worth remembering about this payment"
          {...register('note')}
        />
      </div>

      <div className="border-t border-neutral-100 pt-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            {...register('checkInNow')}
          />
          <span className="flex-1">
            <span className="block text-sm font-medium">
              Check this member in
            </span>
            <span className="block text-xs text-neutral-500 mt-0.5">
              Logs a visit so they appear on the mission-control live feed and
              the &ldquo;Currently here&rdquo; count. If a pass was granted
              above, one use is deducted. Uncheck if the member paid but
              isn&apos;t on-site yet.
            </span>
          </span>
        </label>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Recording…' : 'Record payment'}
        </Button>
        <p className="text-xs text-neutral-500">
          The member is granted the product immediately.
        </p>
      </div>
    </form>
  )
}
