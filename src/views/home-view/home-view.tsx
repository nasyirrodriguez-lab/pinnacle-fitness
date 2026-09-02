import {
  Section,
  Eyebrow,
  Display,
  Stat,
  Pill,
  PhotoSlot,
  Mark,
  GYM,
} from '@/components/marketing/primitives'

const THREE_THINGS = [
  {
    title: 'Coached small groups',
    body: `Every PT session is a small group of up to ${GYM.groupCap}, run by Nasyir or Matthew. A coach who knows your name, your goals, and what you did last week.`,
  },
  {
    title: 'Open gym on the turf',
    body: 'Open skies, a full weight floor, machines, and a dedicated turf area. Scan in, put your headphones on, do the work.',
  },
  {
    title: 'A community that shows up',
    body: 'You push because the person next to you is pushing. That is the whole point.',
  },
]

const MEMBER_CODE = [
  'Respect the equipment. Re-rack what you use.',
  'Respect people’s space and their time.',
  'No filming other members.',
  'Show up for what you book — or cancel in time.',
  'Leave the floor better than you found it.',
]

export default function HomeView() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 md:px-10 pt-20 pb-16 md:pt-28 md:pb-24 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-end">
          <div>
            <Eyebrow>{GYM.name} · {GYM.venue}</Eyebrow>
            <Display as="h1">
              Train
              <br />
              with us.
            </Display>
            <p className="mt-8 max-w-xl text-lg md:text-xl text-muted-foreground leading-relaxed">
              A members-only coached gym in Port of Spain. Small groups, real
              programming, and an outdoor floor built for people who already
              train and want to be pushed further.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Pill href="/apply">Apply to join</Pill>
              <Pill href="/pricing" variant="outline">
                See memberships
              </Pill>
            </div>
          </div>
          <PhotoSlot
            alt="Training on the turf at Pinnacle Fitness"
            className="aspect-[4/5] lg:aspect-[3/4]"
            priority
          />
        </div>
        <Mark className="pointer-events-none absolute -right-16 -bottom-24 w-[22rem] text-card" />
      </section>

      <Section className="border-y border-border">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-10 items-start">
          <Display>Pinnacle isn’t a first gym.</Display>
          <div className="text-lg text-muted-foreground leading-relaxed space-y-4">
            <p>
              Our sessions are coached and progressive, so we look for people
              who already train consistently and want to be pushed further.
            </p>
            <p>
              Membership is by application. We keep numbers small so coaches
              know every member, and we open spots as they come up.
            </p>
            <Pill href="/apply" variant="outline" className="mt-2">
              Read how applying works
            </Pill>
          </div>
        </div>
      </Section>

      <Section>
        <Eyebrow>What you get</Eyebrow>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {THREE_THINGS.map((t) => (
            <div
              key={t.title}
              className="bg-card border border-border rounded-[22px] p-7 flex flex-col gap-4 min-h-64"
            >
              <Display as="h3">{t.title}</Display>
              <p className="text-muted-foreground leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-primary text-primary-foreground rounded-none">
        <div className="grid grid-cols-3 gap-6 md:gap-12">
          <Stat value="2" label="Head coaches" className="[&>div:first-child]:text-primary-foreground [&>div:last-child]:text-primary-foreground/70" />
          <Stat value={GYM.floorCap} label="Person floor" className="[&>div:first-child]:text-primary-foreground [&>div:last-child]:text-primary-foreground/70" />
          <Stat value={GYM.groupCap} label="Per session" className="[&>div:first-child]:text-primary-foreground [&>div:last-child]:text-primary-foreground/70" />
        </div>
      </Section>

      <Section>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-10 items-start">
          <div>
            <Eyebrow>The Member Code</Eyebrow>
            <Display>How we train here.</Display>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              Everyone who joins agrees to it. It is short on purpose.
            </p>
          </div>
          <ol className="bg-card border border-border rounded-[22px] divide-y divide-border">
            {MEMBER_CODE.map((line, i) => (
              <li key={line} className="flex items-start gap-5 px-7 py-5">
                <span className="font-stat text-2xl text-primary leading-none pt-0.5">
                  {i + 1}
                </span>
                <span className="text-lg">{line}</span>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section className="border-t border-border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          <div>
            <Eyebrow>Hours</Eyebrow>
            <dl className="divide-y divide-border border-y border-border">
              {GYM.hours.map((h) => (
                <div
                  key={h.days}
                  className="flex items-baseline justify-between gap-6 py-4"
                >
                  <dt className="text-muted-foreground">{h.days}</dt>
                  <dd className="font-stat text-xl">{h.time}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <Eyebrow>Where</Eyebrow>
            <p className="text-2xl font-heading font-bold uppercase leading-tight">
              {GYM.venue}
            </p>
            <p className="mt-2 text-muted-foreground">{GYM.address}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Pill
                href="https://maps.google.com/?q=227+Western+Main+Rd+Port+of+Spain"
                variant="outline"
                external
              >
                Directions
              </Pill>
              <Pill href="/contact" variant="ghost">
                Contact
              </Pill>
            </div>
          </div>
        </div>
      </Section>

      <Section className="bg-card">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <Display>Come train with us.</Display>
            <p className="mt-4 max-w-lg text-muted-foreground text-lg">
              Apply, meet a coach at an intro session, pick a plan. The fastest
              way to know if this place is for you is to be in it.
            </p>
          </div>
          <Pill href="/apply" className="shrink-0 text-base px-8 py-4">
            Apply to join
          </Pill>
        </div>
      </Section>
    </>
  )
}
