-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Members table
create table if not exists public.members (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  name        text not null,
  email       text not null,
  plan_type   text not null check (plan_type in ('basic', 'premium', 'elite')) default 'basic',
  join_date   date not null default current_date,
  member_id   text not null unique,
  role        text not null check (role in ('member', 'admin')) default 'member',
  status      text not null check (status in ('active', 'suspended')) default 'active',
  created_at  timestamptz default now()
);

-- Add status column if upgrading an existing DB
alter table public.members add column if not exists
  status text not null check (status in ('active', 'suspended')) default 'active';

-- Row Level Security
alter table public.members enable row level security;

-- Members can read their own record
create policy "Members can read own profile"
  on public.members for select
  using (auth.uid() = user_id);

-- Admins can read all members
create policy "Admins can read all members"
  on public.members for select
  using (
    exists (
      select 1 from public.members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Members can insert their own record (during signup)
create policy "Members can insert own profile"
  on public.members for insert
  with check (auth.uid() = user_id);

-- Admins can update any member
create policy "Admins can update members"
  on public.members for update
  using (
    exists (
      select 1 from public.members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- To make a user an admin, run:
-- update public.members set role = 'admin' where email = 'your@email.com';

-- ============================================================
-- Plans table (marketing pricing page)
-- ============================================================
create table if not exists public.plans (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique check (slug in ('basic', 'premium', 'elite')),
  price       integer not null,
  duration    text not null default 'month',
  features    text[] not null default '{}',
  highlight   boolean not null default false,
  created_at  timestamptz default now()
);

alter table public.plans enable row level security;

create policy "Anyone can read plans"
  on public.plans for select
  using (true);

-- Seed plans
insert into public.plans (name, slug, price, duration, features, highlight) values
  ('Basic',   'basic',   29, 'month',
   array['Full gym floor access','Cardio equipment','Locker rooms & showers','Free fitness assessment'],
   false),
  ('Premium', 'premium', 59, 'month',
   array['Everything in Basic','Unlimited group classes','Sauna & steam room','2 guest passes/month','Nutrition workshop access'],
   true),
  ('Elite',   'elite',   99, 'month',
   array['Everything in Premium','4 PT sessions/month','24/7 gym access','Dedicated locker','Quarterly body composition scan','Priority class booking'],
   false)
on conflict (slug) do nothing;

-- ============================================================
-- Coaches table (marketing coaches page)
-- ============================================================
create table if not exists public.coaches (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  photo_url    text not null default '',
  specialties  text[] not null default '{}',
  bio          text not null default '',
  "order"      integer not null default 0,
  created_at   timestamptz default now()
);

alter table public.coaches enable row level security;

create policy "Anyone can read coaches"
  on public.coaches for select
  using (true);

-- Seed coaches
insert into public.coaches (name, photo_url, specialties, bio, "order") values
  ('Marcus Rivera',
   'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus&backgroundColor=b6e3f4',
   array['Strength & Conditioning','Powerlifting','Sports Performance'],
   'Former collegiate athlete with 10+ years of coaching experience. Marcus specializes in building raw strength and athletic performance through evidence-based programming.',
   1),
  ('Priya Nair',
   'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya&backgroundColor=d1d4f9',
   array['Yoga & Mobility','Functional Fitness','Rehabilitation'],
   'Certified yoga instructor and functional movement specialist. Priya helps clients move pain-free, improve flexibility, and build a body that lasts.',
   2),
  ('Jake Thompson',
   'https://api.dicebear.com/7.x/avataaars/svg?seed=Jake&backgroundColor=c0aede',
   array['HIIT & Cardio','Weight Loss','Group Classes'],
   'High-energy coach who thrives in group settings. Jake''s HIIT sessions are legendary — expect to work hard, laugh harder, and see real results.',
   3),
  ('Sofia Mendes',
   'https://api.dicebear.com/7.x/avataaars/svg?seed=Sofia&backgroundColor=ffdfbf',
   array['Nutrition Coaching','Body Composition','Mindset & Wellness'],
   'Registered dietitian turned personal trainer. Sofia takes a holistic approach to health — because what you eat and how you think matters as much as how you train.',
   4),
  ('Deon Williams',
   'https://api.dicebear.com/7.x/avataaars/svg?seed=Deon&backgroundColor=ffd5dc',
   array['Boxing & Combat Fitness','Cardio Conditioning','Confidence Building'],
   'Ex-amateur boxer turned certified PT. Deon brings intensity and discipline from the ring to every training session — beginners and advanced athletes alike.',
   5),
  ('Lena Kowalski',
   'https://api.dicebear.com/7.x/avataaars/svg?seed=Lena&backgroundColor=b6e3f4',
   array['Pilates','Posture Correction','Pre/Postnatal Fitness'],
   'Pilates-certified trainer with a background in dance. Lena''s clients love her attention to form, her calming coaching style, and the deep core burn she delivers.',
   6)
on conflict do nothing;

-- ============================================================
-- Check-ins table (admin dashboard — realtime)
-- ============================================================
create table if not exists public.check_ins (
  id              uuid primary key default uuid_generate_v4(),
  member_id       uuid references public.members(id) on delete cascade not null,
  member_code     text not null,
  member_name     text not null,
  method          text not null check (method in ('qr', 'manual', 'app')) default 'manual',
  checked_in_at   timestamptz not null default now()
);

create index if not exists check_ins_member_id_idx on public.check_ins(member_id);
create index if not exists check_ins_checked_in_at_idx on public.check_ins(checked_in_at desc);

alter table public.check_ins enable row level security;

-- Only admins can read/insert check-ins
create policy "Admins can manage check_ins"
  on public.check_ins for all
  using (
    exists (
      select 1 from public.members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Enable realtime for check_ins (run in Supabase dashboard → Database → Replication,
-- or use the SQL below)
alter publication supabase_realtime add table public.check_ins;

-- ============================================================
-- Payments table (admin revenue section)
-- ============================================================
create table if not exists public.payments (
  id            uuid primary key default uuid_generate_v4(),
  member_id     uuid references public.members(id) on delete cascade not null,
  member_name   text not null,
  plan_type     text not null check (plan_type in ('basic', 'premium', 'elite')),
  amount        numeric(10, 2) not null,
  paid_at       timestamptz not null default now(),
  status        text not null check (status in ('paid', 'failed', 'refunded')) default 'paid'
);

create index if not exists payments_member_id_idx on public.payments(member_id);
create index if not exists payments_paid_at_idx on public.payments(paid_at desc);

alter table public.payments enable row level security;

-- Only admins can read payments
create policy "Admins can read payments"
  on public.payments for select
  using (
    exists (
      select 1 from public.members
      where user_id = auth.uid() and role = 'admin'
    )
  );
