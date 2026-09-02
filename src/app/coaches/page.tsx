import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import {
  Section,
  Eyebrow,
  Display,
  Pill,
  PhotoSlot,
} from '@/components/marketing/primitives'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Coaches — Pinnacle Fitness',
  description:
    'Nasyir Rodriguez and Matthew Sirjoo — the co-founders and head coaches at Pinnacle Fitness, Port of Spain.',
}

interface CoachCard {
  slug: string
  name: string
  role: string
  bio: string
  photo: string | null
}

const FALLBACK: CoachCard[] = [
  {
    slug: 'nasyir',
    name: 'Nasyir Rodriguez',
    role: 'Co-founder · Head coach',
    bio: 'Co-founder of Pinnacle Fitness and head coach. Nasyir built this gym around one belief: that the right environment changes everything. His coaching is direct, progressive, and built for real people with real goals.',
    photo: null,
  },
  {
    slug: 'matthew',
    name: 'Matthew Sirjoo',
    role: 'Co-founder · Head coach',
    bio: 'Co-founder and head coach at Pinnacle. Matthew brings structure and precision to every program. His approach is methodical: consistency built on the right foundation is what produces lasting results.',
    photo: null,
  },
]

async function loadCoaches(): Promise<CoachCard[]> {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data } = await supabase
      .from('coaches')
      .select('slug, display_name, bio, photo_path, is_active, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    const rows = (data as Record<string, unknown>[] | null) ?? []
    if (rows.length === 0) return FALLBACK
    return rows.map((r) => {
      const slug = r.slug as string
      const fallback = FALLBACK.find((f) => f.slug === slug)
      return {
        slug,
        name: r.display_name as string,
        role: fallback?.role ?? 'Coach',
        bio: ((r.bio as string | null) ?? fallback?.bio ?? '').trim(),
        photo: (r.photo_path as string | null) ?? null,
      }
    })
  } catch {
    return FALLBACK
  }
}

export default async function CoachesPage() {
  const coaches = await loadCoaches()

  return (
    <>
      <Section className="pb-10">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-10 items-end">
          <div>
            <Eyebrow>The team</Eyebrow>
            <Display as="h1">The people behind Pinnacle.</Display>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Two coaches, one belief: the right environment changes everything.
            Every session you book is with one of them.
          </p>
        </div>
      </Section>

      <Section className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {coaches.map((c) => (
            <article
              key={c.slug}
              className="bg-card border border-border rounded-[22px] overflow-hidden flex flex-col"
            >
              <PhotoSlot
                src={c.photo}
                alt={`${c.name}, coach at Pinnacle Fitness`}
                className="aspect-[4/3] rounded-none border-0 border-b border-border"
              />
              <div className="p-7 flex flex-col gap-4 flex-1">
                <div>
                  <Display as="h2" className="text-2xl sm:text-3xl">
                    {c.name}
                  </Display>
                  <p className="mt-2 text-[11px] font-semibold tracking-[0.16em] uppercase text-primary">
                    {c.role}
                  </p>
                </div>
                <p className="text-muted-foreground leading-relaxed flex-1">
                  {c.bio}
                </p>
                <Pill
                  href={`/sign-in?next=${encodeURIComponent(`/book/pt-${c.slug}`)}`}
                  className="self-start"
                >
                  Book with {c.name.split(' ')[0]}
                </Pill>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Not a member yet?{' '}
          <a href="/apply" className="text-primary underline underline-offset-4">
            Apply to join
          </a>{' '}
          and meet a coach at your intro session.
        </p>
      </Section>
    </>
  )
}
