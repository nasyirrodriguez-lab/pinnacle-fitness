# Pinnacle Fitness — Gym Membership Portal

A gym membership web app built with Next.js 15, Tailwind CSS, and Supabase.

## Features

- **Auth** — Email/password login & signup via Supabase Auth
- **Member Dashboard** — Name, plan, join date, and QR check-in code
- **QR Code** — Generated from unique member ID using the `qrcode` npm package
- **Admin Panel** — `/admin` route (role-protected) listing all members with stats
- **Dark theme** — Zinc/black palette with orange accents throughout

## Stack

- Next.js 15 (App Router)
- Tailwind CSS v4
- Supabase (Auth + Postgres)
- `qrcode` npm package

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the schema

In your Supabase project's **SQL Editor**, run the contents of `supabase-schema.sql`.

### 3. Configure environment variables

Edit `.env.local` with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Find these in Supabase → **Settings → API**.

### 4. Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Grant admin access

After signing up, run this in the Supabase SQL Editor:

```sql
update public.members set role = 'admin' where email = 'your@email.com';
```

Then visit `/admin` after logging in.

## Routes

| Route | Description |
|-------|-------------|
| `/` | Redirects to `/auth` or `/dashboard` |
| `/auth` | Login / signup page |
| `/dashboard` | Member dashboard with QR code |
| `/admin` | Admin-only member list |
