import type { Metadata } from 'next'
import {
  Section,
  Eyebrow,
  Display,
  Pill,
} from '@/components/marketing/primitives'

export const metadata: Metadata = {
  title: 'Programs — Pinnacle Fitness',
  description:
    'Strength training, sport-specific performance, bootcamps and open gym at Pinnacle Fitness, Port of Spain. Coached, progressive, built for people who already train.',
}

const PROGRAMS = [
  {
    code: 'ST',
    name: 'Strength Training',
    featured: false,
    body: 'Built for people who want to get stronger, wherever they are starting from. Progressive, structured, and coached, so you are never guessing. You will build real muscle, real confidence, and a real habit. Show up, lift, repeat.',
  },
  {
    code: 'SP',
    name: 'Sport Specific Performance',
    featured: true,
    tag: 'Athlete program',
    body: 'For competitive athletes who need targeted development to lift their game. We find the precise physical limits — explosive power, lateral quickness, deceleration, positional strength — holding you back on the field or court, and train them. This is not general fitness. This is precision work built around your sport, your position, and your next level.',
  },
  {
    code: 'BC',
    name: 'Bootcamps',
    featured: false,
    body: 'Where the community comes alive. High-energy group sessions on the turf that mix strength, cardio, and the kind of collective grind that makes you forget how hard you are working. You push because the person next to you is pushing.',
  },
  {
    code: 'OG',
    name: 'Open Gym',
    featured: false,
    body: 'Your schedule, your workout, your pace. Weights, machines, and turf, any time we are open. Scan in at the door, and if there is room on the floor you are in. Some of our best members come in, put their headphones on, do the work, and leave better than they arrived.',
  },
]

export default function ProgramsPage() {
  return (
    <>
      <Section className="pb-10">
        <Eyebrow>Programs</Eyebrow>
        <Display as="h1">Train with intention.</Display>
        <p className="mt-8 max-w-2xl text-lg text-muted-foreground leading-relaxed">
          Every program at Pinnacle is built to deliver results, not just
          effort. Pick your path and let the coaches take you there.
        </p>
      </Section>

      <div className="border-t border-border">
        {PROGRAMS.map((p) => (
          <div
            key={p.code}
            className={
              p.featured
                ? 'bg-primary text-primary-foreground'
                : 'border-b border-border'
            }
          >
            <div className="max-w-6xl mx-auto px-6 md:px-10 py-12 md:py-16 grid grid-cols-[4rem_1fr] md:grid-cols-[8rem_1fr] gap-6 md:gap-12 items-start">
              <span
                className={
                  p.featured
                    ? 'font-stat text-4xl md:text-6xl leading-none text-primary-foreground/80'
                    : 'font-stat text-4xl md:text-6xl leading-none text-primary'
                }
              >
                {p.code}
              </span>
              <div>
                {p.tag && (
                  <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-3 opacity-80">
                    {p.tag}
                  </p>
                )}
                <Display as="h2" className="text-2xl sm:text-4xl">
                  {p.name}
                </Display>
                <p
                  className={
                    p.featured
                      ? 'mt-5 max-w-2xl leading-relaxed text-primary-foreground/85'
                      : 'mt-5 max-w-2xl leading-relaxed text-muted-foreground'
                  }
                >
                  {p.body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Section className="bg-card">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <Display>Every membership covers every program.</Display>
            <p className="mt-4 max-w-lg text-muted-foreground text-lg">
              Sessions are coached small groups. Open gym runs on a live floor
              count, so you always know if there is room before you leave home.
            </p>
          </div>
          <Pill href="/pricing" className="shrink-0">
            See memberships
          </Pill>
        </div>
      </Section>
    </>
  )
}
