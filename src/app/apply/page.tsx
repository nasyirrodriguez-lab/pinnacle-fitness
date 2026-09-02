import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import {
  Section,
  Eyebrow,
  Display,
} from '@/components/marketing/primitives'
import ApplyForm, { type PlanOption } from '@/components/marketing/apply-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Apply to join — Pinnacle Fitness',
  description:
    'Membership at Pinnacle Fitness is by application. Tell us how you train, meet a coach at an intro session, then pick a plan.',
}

interface PageProps {
  searchParams: Promise<{ plan?: string }>
}

async function loadPlans(): Promise<PlanOption[]> {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data } = await supabase
      .from('plans')
      .select('id, name')
      .eq('is_active', true)
      .eq('is_private', false)
      .order('display_order', { ascending: true })
    return ((data as { id: string; name: string }[] | null) ?? []).map(
      (p) => ({ id: p.id, name: p.name })
    )
  } catch {
    return []
  }
}

const STEPS = [
  {
    n: '1',
    title: 'Apply',
    body: 'Five minutes. How you train, what you want, who sent you.',
  },
  {
    n: '2',
    title: 'Intro session',
    body: 'Come train. Meet Nasyir and Matthew, see the floor, feel the pace.',
  },
  {
    n: '3',
    title: 'Pick a plan',
    body: 'If it fits both ways, choose your membership and you are in.',
  },
]

export default async function ApplyPage({ searchParams }: PageProps) {
  const [{ plan }, plans] = await Promise.all([searchParams, loadPlans()])

  return (
    <>
      <Section className="pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 items-start">
          <div>
            <Eyebrow>Membership by application</Eyebrow>
            <Display as="h1">Apply to join.</Display>
            <p className="mt-8 max-w-lg text-lg text-muted-foreground leading-relaxed">
              Pinnacle isn&apos;t a first gym. Our sessions are coached and
              progressive, so we look for people who already train
              consistently and want to be pushed further. We keep numbers
              small so coaches know every member, and we open spots as they
              come up.
            </p>
            <ol className="mt-10 space-y-6">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-5">
                  <span className="font-stat text-4xl text-primary leading-none">
                    {s.n}
                  </span>
                  <div>
                    <p className="font-heading font-bold uppercase text-lg">
                      {s.title}
                    </p>
                    <p className="text-muted-foreground">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <ApplyForm plans={plans} defaultPlan={plan} />
        </div>
      </Section>
    </>
  )
}
