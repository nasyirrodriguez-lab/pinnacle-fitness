# Pinnacle Fitness — project guide

Members-only coached gym at The Playground — Sport & Social, 227 Western Main Rd, Port of Spain. Owners/coaches: Nasyir (688-6887) and Matthew (724-5734). Domain: pinnaclefitness.app. This codebase is a fork of The Worx coworking platform, refitted for a gym: applications + waitlist, monthly plans and session packs, PT booking per coach, open-gym floor cap, iPad QR check-in, Wam payments, coach dashboards and an owners' business portal.

## Stack

- Next.js 16 (App Router, Server Actions, route handlers), TypeScript strict
- Tailwind CSS v4 (`src/theme/globals.css` is the design system), shadcn/ui
- Supabase (Postgres + Auth + Storage; RLS on every table; admin client only server-side)
- Wam payments (`@zed-io/wam-payment-sdk`) — webhook-only confirmation
- Resend for email, Vercel for hosting + crons (`vercel.json`)
- Node 22.x (`.npmrc` is engine-strict)

```bash
npm install
npm run dev          # http://localhost:3000
npx tsc --noEmit     # types
npm run lint
npm run build
```

## Brand & design system

Dark only. Three colours, nothing else:

| Role | Token | Hex |
| --- | --- | --- |
| Ground (app background) | `bg-ground` | #0B0E0C |
| Urbane Bronze — card surface (SW 7048) | `bg-bronze` | #2B2925 |
| Bronze raised (chips, secondary buttons) | `bg-bronze-raised` | #54504B |
| Bronze line (borders) | `border-bronze-line` | #3D3A35 |
| Crushed Ice — text | `text-ice` | #E5E8E6 |
| Ice dim / mute | `text-ice-dim` / `text-ice-mute` | #B3B7B3 / #8A8D89 |
| Artificial Turf — the ONLY action colour | `bg-turf` / `text-turf` | #4EC95C (ink on turf: `text-turf-ink` #06120A) |
| Warn / bad | `text-warn` / `text-bad` | #E0A24A / #E2624F |

shadcn semantic tokens map onto these (`bg-background`, `bg-card`, `bg-primary`…). Nasyir's sessions read turf-filled, Matthew's ice-filled.

**Why `bg-white` is bronze:** the forked code uses Tailwind palette classes everywhere. Instead of rewriting hundreds of files, `globals.css` remaps them: `white` → card bronze, the `neutral` scale is inverted (`text-neutral-900` = ice, `bg-neutral-50` = near-ground), `turquoise`/`lime`/`green` → turf scale (700 = turf text on dark, 50 = faint tint), `darkBlue` → raised bronze, `orange`/`darkOrange` → amber, `red` → red, `blue`/`slate`/`pink` → greys. A few utility overrides keep `text-white` light and turn `text-darkBlue-900` links turf. New code should use the semantic tokens or the turf/bronze/ice names.

**Type:** Archivo for everything (variable width + italic). `font-heading` = wide (wdth 112) weight 800; `heading-display` = wdth 118, uppercase, tight — marketing heroes; `font-stat` = Archivo Black Italic, wide, tight — every number that means money or progress (sessions left, revenue, check-ins).

**Shape:** buttons are pills (`rounded-full`, the `Button` component already is). Cards use `rounded-lg`/`rounded-card` (22px). Calendar days are circles. Mobile nav is a floating pill bar with the QR as the one turf circle.

**Voice:** direct, no apology. "Pinnacle isn't a first gym." Membership by application; capacity and coaching are the reasons, never people.

## Layout of the app

```
src/app/
  (marketing)      /, /programs, /coaches, /pricing, /apply, /contact
  auth, sign-in    magic link + password
  welcome          onboarding (Nike-style steps)
  dashboard/       member home, bookings, plan, messages, settings
  book/            PT booking (per coach) — open gym is check-in only
  checkin/         iPad kiosk (paired device) + phone flows
  admin/           coaches + owners: members, applications, bookings,
                   payments, finance, catalog, messages, feedback, shop
  api/             checkout, payments (Wam webhook), cron, checkin
src/lib/           booking, payments, credits, email, notifications…
supabase/migrations/000_pinnacle.sql   single idempotent migration
```

## Conventions

- Server actions: `'use server'` + `assertAdmin()` + zod parse + `createAdminClient()` + `revalidatePath` for the page the admin is on.
- Client components: `useState` + `useTransition` + `router.refresh()`.
- Only the Wam `payment_intent.succeeded` webhook (or an explicit admin verify) marks a payment paid. Never provision on optimism.
- Migrations: one combined idempotent file. Apply live first, then mirror in the file.
- Times are America/Port_of_Spain; helpers in `src/lib/time/ast.ts`.

## Git

- Small, focused commits; lowercase, present tense, under ~50 chars ("add coach availability").
- husky + lint-staged run ESLint and Prettier on commit.
