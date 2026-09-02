-- The Worx — combined idempotent migration.
-- Safe to paste into the Supabase SQL editor multiple times. All creates use
-- `if not exists`, all seeds use `on conflict do nothing`, all functions use
-- `create or replace`. Re-running has no destructive effect.

-- =====================================================================
-- Extensions
-- =====================================================================
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- =====================================================================
-- profiles: 1:1 with auth.users, holds member-facing data
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  phone text,
  company text,
  role text not null default 'member' check (role in ('member', 'admin')),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extra fields from the Nexudus member import
alter table public.profiles add column if not exists nexudus_id text;
alter table public.profiles add column if not exists pincode text;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists registered_at timestamptz;
alter table public.profiles add column if not exists last_access_at timestamptz;
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists selfie_path text;
alter table public.profiles add column if not exists referral_code text;

-- Designations: staff / investors / community contributors get a badge
-- in admin views and check in free (no pass required or deducted).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'designation'
  ) then
    alter table public.profiles add column designation text
      check (designation is null or designation in ('staff','investor','community_contributor'));
  end if;
end $$;

create index if not exists profiles_role_idx
  on public.profiles (role) where archived = false;
create unique index if not exists profiles_nexudus_id_idx
  on public.profiles (nexudus_id) where nexudus_id is not null;
create index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));
create unique index if not exists profiles_referral_code_idx
  on public.profiles (referral_code) where referral_code is not null;
create index if not exists profiles_terms_idx
  on public.profiles (terms_version) where terms_version is not null;

-- =====================================================================
-- Catalog: plans, passes, resources. All prices in cents.
-- =====================================================================
create table if not exists public.plans (
  id text primary key,
  name text not null,
  description text,
  price_cents integer not null,
  discounted_price_cents integer,
  discount_expires_at timestamptz,
  currency text not null default 'TTD',
  billing_period text not null default 'month' check (billing_period in ('month', 'year')),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Older deployments predate the discount columns; idempotent backfills.
alter table public.plans
  add column if not exists discounted_price_cents integer,
  add column if not exists discount_expires_at timestamptz;

create table if not exists public.passes (
  id text primary key,
  name text not null,
  description text,
  price_cents integer not null,
  discounted_price_cents integer,
  discount_expires_at timestamptz,
  currency text not null default 'TTD',
  uses_total integer not null,
  validity_days integer not null default 365,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.passes
  add column if not exists discount_expires_at timestamptz;

create table if not exists public.resources (
  id text primary key,
  name text not null,
  description text,
  kind text not null check (kind in ('meeting-room', 'conference-room', 'event-space', 'hot-desk')),
  capacity integer not null default 1,
  price_per_hour_cents integer,
  price_per_day_cents integer,
  currency text not null default 'TTD',
  open_hour integer not null default 8,
  close_hour integer not null default 20,
  slot_minutes integer not null default 60,
  is_bookable boolean not null default true,
  requires_contact boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Subscriptions: recurring plan billing
-- =====================================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  plan_id text not null references public.plans(id),
  status text not null default 'active' check (status in ('active', 'past_due', 'paused', 'cancelled')),
  started_at timestamptz not null default now(),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  cancelled_at timestamptz,
  paused_at timestamptz,
  pause_until timestamptz,
  wam_card_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_active_idx
  on public.subscriptions (user_id) where status = 'active';
create index if not exists subscriptions_due_idx
  on public.subscriptions (current_period_end) where status = 'active';

-- =====================================================================
-- Passes purchased + redemption tracking
-- =====================================================================
create table if not exists public.pass_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  pass_id text not null references public.passes(id),
  uses_total integer not null,
  uses_remaining integer not null,
  expires_at timestamptz not null,
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists pass_purchases_user_idx
  on public.pass_purchases (user_id, expires_at) where uses_remaining > 0;

-- =====================================================================
-- Pass adjustments — audit log of every admin change to a pass_purchase.
-- One row per +/- adjustment so we can answer "who changed Kyle's pass
-- from 3 to 5 last week, and why?"
--   delta_uses: positive = added uses, negative = removed.
--   reason: free text — "comp", "kiosk check-in", "refund", etc.
--   admin_id: nullable so a system process (kiosk decrement) can write
--     a row too, with admin_id null + reason "kiosk check-in".
-- =====================================================================
create table if not exists public.pass_adjustments (
  id uuid primary key default gen_random_uuid(),
  pass_purchase_id uuid not null references public.pass_purchases(id) on delete cascade,
  delta_uses integer not null check (delta_uses <> 0),
  reason text not null,
  admin_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pass_adjustments_pass_idx
  on public.pass_adjustments (pass_purchase_id, created_at desc);

alter table public.pass_adjustments enable row level security;

drop policy if exists pass_adjustments_admin_read on public.pass_adjustments;
create policy pass_adjustments_admin_read on public.pass_adjustments
  for select using (is_admin());

drop policy if exists pass_adjustments_admin_write on public.pass_adjustments;
create policy pass_adjustments_admin_write on public.pass_adjustments
  for all using (is_admin()) with check (is_admin());

-- =====================================================================
-- Bookings: room/desk reservations with DB-level overlap prevention
-- =====================================================================
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete restrict,
  guest_email text,
  guest_name text,
  resource_id text not null references public.resources(id),
  during tstzrange not null,
  status text not null default 'confirmed' check (status in ('held', 'confirmed', 'cancelled', 'completed', 'no_show')),
  price_cents integer not null,
  payment_id uuid,
  pass_purchase_id uuid references public.pass_purchases(id),
  notes text,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_identity_check check (
    (user_id is not null) or (guest_email is not null and guest_name is not null)
  )
);

create index if not exists bookings_resource_during_idx
  on public.bookings using gist (resource_id, during);

-- Exclusion constraint preventing overlapping non-cancelled bookings on
-- the same resource. Wrapped in DO block because there's no IF NOT EXISTS
-- syntax for constraints.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_no_overlap'
  ) then
    alter table public.bookings
      add constraint bookings_no_overlap
      exclude using gist (
        resource_id with =,
        during with &&
      ) where (status in ('held', 'confirmed'));
  end if;
end $$;

create index if not exists bookings_user_idx
  on public.bookings (user_id, lower(during) desc) where user_id is not null;

-- =====================================================================
-- Payments: every Wam transaction we track
-- =====================================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete restrict,
  wam_payment_id text unique,
  amount_cents integer not null,
  currency text not null default 'TTD',
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded', 'cancelled')),
  kind text not null check (kind in ('subscription', 'pass', 'booking', 'one_time')),
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  failure_reason text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- payment_method distinguishes how money actually changed hands. Wam
-- webhook payments default to 'wam_online' (set by the route handler).
-- Manual reconciliations from the admin record cash, Wam POS taps, bank
-- transfers, etc. external_ref is the lookup key for matching Wam POS
-- auth codes after the fact (no FK — Wam POS doesn't share a schema
-- with us). recorded_by tracks the admin who logged the manual entry.
alter table public.payments
  add column if not exists payment_method text not null default 'wam_online'
    check (payment_method in (
      'wam_online',
      'wam_pos',
      'cash',
      'bank_transfer',
      'other'
    ));
alter table public.payments
  add column if not exists external_ref text;
alter table public.payments
  add column if not exists recorded_by uuid references public.profiles(id);

create index if not exists payments_user_idx
  on public.payments (user_id, created_at desc);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_method_idx on public.payments (payment_method);
create unique index if not exists payments_external_ref_idx
  on public.payments (external_ref) where external_ref is not null;

-- Late-bind FK from bookings → payments (avoids circular create-order issue)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_payment_fk'
  ) then
    alter table public.bookings
      add constraint bookings_payment_fk
      foreign key (payment_id) references public.payments(id) on delete set null;
  end if;
end $$;

-- =====================================================================
-- Booking groups: multiple bookings made in one checkout, one payment
-- =====================================================================
create table if not exists public.booking_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  total_cents integer not null,
  currency text not null default 'TTD',
  status text not null default 'held' check (status in ('held', 'confirmed', 'cancelled', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_groups_user_idx
  on public.booking_groups (user_id, created_at desc);
create index if not exists booking_groups_held_idx
  on public.booking_groups (expires_at) where status = 'held';

-- Admin-on-behalf bookings: allow a booking_group to represent a guest
-- (someone without a member profile) by relaxing user_id and adding
-- guest contact fields. Mirrors the existing pattern on `bookings`.
alter table public.booking_groups
  alter column user_id drop not null;
alter table public.booking_groups
  add column if not exists guest_name text,
  add column if not exists guest_email text,
  add column if not exists guest_phone text;

-- Bookings get a group reference. Late-bound so booking_groups exists first.
alter table public.bookings
  add column if not exists booking_group_id uuid references public.booking_groups(id) on delete set null;

create index if not exists bookings_group_idx
  on public.bookings (booking_group_id) where booking_group_id is not null;

-- =====================================================================
-- Invoices: receipts/billing documents
-- =====================================================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  number text unique not null,
  payment_id uuid references public.payments(id),
  amount_cents integer not null,
  tax_cents integer not null default 0,
  total_cents integer not null,
  currency text not null default 'TTD',
  status text not null default 'paid' check (status in ('draft', 'paid', 'void', 'refunded')),
  line_items jsonb not null default '[]'::jsonb,
  bill_to jsonb,
  pdf_url text,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists invoices_user_idx
  on public.invoices (user_id, issued_at desc);

create sequence if not exists invoices_seq start 1;
create or replace function generate_invoice_number()
returns text language plpgsql as $$
begin
  return 'WRX-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoices_seq')::text, 6, '0');
end $$;

-- =====================================================================
-- Check-ins: building access logs
-- =====================================================================
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  scanned_by text not null default 'self' check (scanned_by in ('self', 'guard', 'tablet')),
  location text,
  member_status text,
  allowed boolean not null,
  notes text
);

create index if not exists check_ins_user_idx
  on public.check_ins (user_id, scanned_at desc);
create index if not exists check_ins_today_idx
  on public.check_ins (scanned_at desc);

-- =====================================================================
-- Admin notes on members (CRM)
-- =====================================================================
create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_notes_user_idx
  on public.admin_notes (user_id, created_at desc);

-- =====================================================================
-- Email log
-- =====================================================================
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  to_email text not null,
  template text not null,
  subject text not null,
  resend_message_id text,
  status text not null default 'sent' check (status in ('sent', 'failed', 'queued')),
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists email_log_user_idx
  on public.email_log (user_id, sent_at desc) where user_id is not null;
create index if not exists email_log_template_idx
  on public.email_log (template, sent_at desc);

-- =====================================================================
-- Unsubscribes
-- =====================================================================
create table if not exists public.unsubscribes (
  email text primary key,
  scope text not null default 'broadcast' check (scope in ('broadcast', 'all')),
  opted_out_at timestamptz not null default now()
);

-- =====================================================================
-- updated_at triggers (idempotent: drop+recreate)
-- =====================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function set_updated_at();

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function set_updated_at();

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings
  for each row execute function set_updated_at();

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at before update on public.payments
  for each row execute function set_updated_at();

drop trigger if exists booking_groups_updated_at on public.booking_groups;
create trigger booking_groups_updated_at before update on public.booking_groups
  for each row execute function set_updated_at();

-- =====================================================================
-- Auto-create profile row when an auth user signs up
-- =====================================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Some auth flows insert users without an email (e.g. anonymous sign-ins).
  -- Skip those — profiles.email is NOT NULL.
  if new.email is null then
    return new;
  end if;
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.pass_purchases enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.check_ins enable row level security;
alter table public.admin_notes enable row level security;
alter table public.email_log enable row level security;
alter table public.booking_groups enable row level security;
alter table public.plans enable row level security;
alter table public.passes enable row level security;
alter table public.resources enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and archived = false
  )
$$;

-- Drop+recreate every policy so re-running this script doesn't error
drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans
  for select using (is_active = true);

drop policy if exists passes_public_read on public.passes;
create policy passes_public_read on public.passes
  for select using (is_active = true);

drop policy if exists resources_public_read on public.resources;
create policy resources_public_read on public.resources
  for select using (true);

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (auth.uid() = id or is_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id or is_admin());

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert with check (is_admin());

drop policy if exists subscriptions_user_read on public.subscriptions;
create policy subscriptions_user_read on public.subscriptions
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists subscriptions_admin_write on public.subscriptions;
create policy subscriptions_admin_write on public.subscriptions
  for all using (is_admin()) with check (is_admin());

drop policy if exists pass_purchases_user_read on public.pass_purchases;
create policy pass_purchases_user_read on public.pass_purchases
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists pass_purchases_admin_write on public.pass_purchases;
create policy pass_purchases_admin_write on public.pass_purchases
  for all using (is_admin()) with check (is_admin());

drop policy if exists bookings_user_read on public.bookings;
create policy bookings_user_read on public.bookings
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists bookings_admin_write on public.bookings;
create policy bookings_admin_write on public.bookings
  for all using (is_admin()) with check (is_admin());

drop policy if exists payments_user_read on public.payments;
create policy payments_user_read on public.payments
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists payments_admin_write on public.payments;
create policy payments_admin_write on public.payments
  for all using (is_admin()) with check (is_admin());

drop policy if exists invoices_user_read on public.invoices;
create policy invoices_user_read on public.invoices
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists invoices_admin_write on public.invoices;
create policy invoices_admin_write on public.invoices
  for all using (is_admin()) with check (is_admin());

drop policy if exists check_ins_user_read on public.check_ins;
create policy check_ins_user_read on public.check_ins
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists check_ins_admin_write on public.check_ins;
create policy check_ins_admin_write on public.check_ins
  for all using (is_admin()) with check (is_admin());

drop policy if exists admin_notes_admin_all on public.admin_notes;
create policy admin_notes_admin_all on public.admin_notes
  for all using (is_admin()) with check (is_admin());

drop policy if exists email_log_user_read on public.email_log;
create policy email_log_user_read on public.email_log
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists email_log_admin_write on public.email_log;
create policy email_log_admin_write on public.email_log
  for all using (is_admin()) with check (is_admin());

drop policy if exists booking_groups_user_read on public.booking_groups;
create policy booking_groups_user_read on public.booking_groups
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists booking_groups_admin_write on public.booking_groups;
create policy booking_groups_admin_write on public.booking_groups
  for all using (is_admin()) with check (is_admin());

-- =====================================================================
-- Seed: the 10-product catalog
-- =====================================================================
insert into public.plans (id, name, description, price_cents, billing_period, features, display_order) values
  ('hot-desk-monthly',
   'Hot Desk',
   'Access to any available hot desk during business hours.',
   100000, 'month',
   '["Access to any available hot desk during business hours","High-speed Wi-Fi","Access to common areas","Printing and scanning services","Meeting room credits"]'::jsonb,
   10),
  ('dedicated-desk-monthly',
   'Dedicated Desk',
   'Your own dedicated desk in a shared workspace.',
   150000, 'month',
   '["Your own dedicated desk in a shared workspace","High-speed Wi-Fi","Access to common areas","Printing and scanning services","Meeting room credits"]'::jsonb,
   20),
  ('private-office-monthly',
   'Private Office',
   'A private office space for your team (up to 6 people).',
   750000, 'month',
   '["A private office space for your team (up to 6 people)","High-speed Wi-Fi","Access to common areas","Printing and scanning services","Meeting room credits"]'::jsonb,
   30),
  ('corner-office-monthly',
   'Corner Office',
   'Our largest private office — a corner suite with extra natural light and room for a bigger team.',
   1000000, 'month',
   '["Corner suite with windows on two sides","Seats your team comfortably","High-speed Wi-Fi","Access to common areas","Printing and scanning services","Meeting room credits"]'::jsonb,
   31),
  ('virtual-office-monthly',
   'Virtual Office',
   'Professional business address and mail handling services.',
   25000, 'month',
   '["Professional business address","Mail handling and forwarding"]'::jsonb,
   40)
on conflict (id) do nothing;

insert into public.passes (id, name, description, price_cents, discounted_price_cents, uses_total, validity_days, features, display_order) values
  ('day-pass',
   'Day Pass',
   'One-day access to a hot desk during business hours.',
   7500, 5000, 1, 365,
   '["One-day access to a hot desk during business hours","High-speed Wi-Fi","Access to common areas","Printing and scanning services"]'::jsonb,
   10),
  ('5-day-pass',
   '5 Day Pass',
   'Five-day access to a hot desk during business hours.',
   25000, null, 5, 365,
   '["Five-day access to a hot desk during business hours","High-speed Wi-Fi","Access to common areas","Printing and scanning services"]'::jsonb,
   20),
  ('10-day-pass',
   '10 Day Pass',
   'Ten-day access to a hot desk during business hours.',
   50000, null, 10, 365,
   '["Ten-day access to a hot desk during business hours","High-speed Wi-Fi","Access to common areas","Printing and scanning services"]'::jsonb,
   30)
on conflict (id) do nothing;

-- Explore Pass: granted automatically to every new member on first onboarding.
-- Hidden from public catalog (is_active=false). 1 free day, expires in 14 days.
insert into public.passes (id, name, description, price_cents, uses_total, validity_days, features, is_active, display_order) values
  ('explore-pass',
   'Explore Pass',
   'A free day on us. Come try The Worx.',
   0, 1, 14,
   '["One full day at a hot desk","High-speed Wi-Fi","Meet the community","Use the meeting rooms (subject to availability)"]'::jsonb,
   false, 0)
on conflict (id) do nothing;

-- Influencer 5-Day Pass: granted manually via /admin/passes/influencer-batch
-- to invited content creators. Hidden from public catalog (is_active=false).
-- 5 uses; validity_days is set high (365) but actual expires_at is
-- overridden at mint time to a campaign-specific date (e.g. 2026-06-06).
insert into public.passes (id, name, description, price_cents, uses_total, validity_days, features, is_active, display_order) values
  ('influencer-5-day-pass',
   'Influencer 5-Day Pass',
   'Complimentary 5-day pass for invited content creators. Includes 30 minutes/day in a meeting room.',
   0, 5, 365,
   '["Access to hot desks and phone booths","High-speed Wi-Fi","Common areas and collaboration spaces","30 minutes/day in a meeting room (up to 3 clients)","Free coffee and tea"]'::jsonb,
   false, 0)
on conflict (id) do nothing;

insert into public.resources (id, name, description, kind, capacity, price_per_hour_cents, open_hour, close_hour, slot_minutes, is_bookable, display_order) values
  ('meeting-room',
   'Meeting Room 1',
   'Book a meeting room for one hour. Seating for up to 4 people, presentation equipment, high-speed Wi-Fi.',
   'meeting-room', 4, 20000, 8, 20, 30, true, 10),
  ('meeting-room-2',
   'Meeting Room 2',
   'Second meeting room. Seating for up to 4 people, presentation equipment, high-speed Wi-Fi.',
   'meeting-room', 4, 20000, 8, 20, 30, true, 15),
  ('conference-room',
   'Conference Room',
   'Book the conference room for one hour. Seating for up to 20 people, presentation equipment and AV system.',
   'conference-room', 20, 45000, 8, 20, 30, true, 20)
on conflict (id) do nothing;

insert into public.resources (id, name, description, kind, capacity, price_per_hour_cents, open_hour, close_hour, slot_minutes, is_bookable, requires_contact, display_order) values
  ('event-space',
   'Coworking Floor — After 5pm',
   'The main coworking floor cleared and reconfigured for your event after 5pm on weekdays, or all day on weekends. Up to 50 people. Co-branded with The Worx — we work with you on programming and promotion.',
   'event-space', 50, null, 17, 22, 60, false, true, 30),
  ('rooftop-event-space',
   'Rooftop — 3rd Floor',
   'Open-air rooftop on the 3rd floor for evening events, launches, mixers, and weekend gatherings. Up to 100 people. Co-branded with The Worx — we partner with you on the event end-to-end.',
   'event-space', 100, null, 17, 23, 60, false, true, 31)
on conflict (id) do nothing;

-- =====================================================================
-- Re-apply renames + slot_minutes updates to existing rows (for projects
-- that already ran an earlier version of this file before these changes).
-- The seed inserts above use ON CONFLICT DO NOTHING and won't update.
-- =====================================================================
update public.resources
  set name = 'Meeting Room 1',
      slot_minutes = 30
  where id = 'meeting-room';

-- Conference room is bookable 9am-5pm AST only (business decision Jul 2026).
update public.resources
  set slot_minutes = 30,
      open_hour = 9,
      close_hour = 17
  where id = 'conference-room';

-- Promo pricing (revived Jul 2026, runs through Aug 31 2026 AST). Seed
-- inserts use ON CONFLICT DO NOTHING, so existing databases pick the
-- current prices + expiry up here.
update public.passes set price_cents = 7500,  discounted_price_cents = 5000,  discount_expires_at = '2026-09-01 03:59:59+00' where id = 'day-pass';
update public.passes set price_cents = 32500, discounted_price_cents = 25000, discount_expires_at = '2026-09-01 03:59:59+00' where id = '5-day-pass';
update public.passes set price_cents = 60000, discounted_price_cents = 50000, discount_expires_at = '2026-09-01 03:59:59+00' where id = '10-day-pass';
update public.plans  set price_cents = 95000,  discounted_price_cents = 75000,  discount_expires_at = '2026-09-01 03:59:59+00' where id = 'hot-desk-monthly';
update public.plans  set price_cents = 145000, discounted_price_cents = 130000, discount_expires_at = '2026-09-01 03:59:59+00' where id = 'dedicated-desk-monthly';

-- Rename the legacy 'event-space' row to the coworking-floor-after-5pm venue
-- and ensure the new rooftop row exists with the right copy. The seed insert
-- above uses ON CONFLICT DO NOTHING so existing databases need this update.
update public.resources
  set name = 'Coworking Floor — After 5pm',
      description = 'The main coworking floor cleared and reconfigured for your event after 5pm on weekdays, or all day on weekends. Up to 50 people. Co-branded with The Worx — we work with you on programming and promotion.',
      capacity = 50
  where id = 'event-space';

insert into public.resources (id, name, description, kind, capacity, price_per_hour_cents, open_hour, close_hour, slot_minutes, is_bookable, requires_contact, display_order)
values (
  'rooftop-event-space',
  'Rooftop — 3rd Floor',
  'Open-air rooftop on the 3rd floor for evening events, launches, mixers, and weekend gatherings. Up to 100 people. Co-branded with The Worx — we partner with you on the event end-to-end.',
  'event-space', 100, null, 17, 23, 60, false, true, 31
) on conflict (id) do nothing;

-- Corner Office plan — added after initial seed, so existing databases
-- need this insert in the re-apply section to pick it up.
insert into public.plans (id, name, description, price_cents, billing_period, features, display_order)
values (
  'corner-office-monthly',
  'Corner Office',
  'Our largest private office — a corner suite with extra natural light and room for a bigger team.',
  1000000,
  'month',
  '["Corner suite with windows on two sides","Seats your team comfortably","High-speed Wi-Fi","Access to common areas","Printing and scanning services","Meeting room credits"]'::jsonb,
  31
) on conflict (id) do nothing;

-- =====================================================================
-- Virtual Office: subscriptions extension + mail items
-- A virtual-office membership is just a subscription with plan_id =
-- 'virtual-office-monthly' plus this extra row tracking the business
-- they're using us as a registered address for, and the non-binding
-- agreement they accepted.
-- =====================================================================
create table if not exists public.virtual_office_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  business_name text not null,
  business_address text,
  intended_use text,
  agreement_version text not null,
  agreement_accepted_at timestamptz not null default now(),
  forwarding_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vo_subs_active_idx
  on public.virtual_office_subscriptions (user_id) where is_active = true;

drop trigger if exists vo_subs_updated_at on public.virtual_office_subscriptions;
create trigger vo_subs_updated_at before update on public.virtual_office_subscriptions
  for each row execute function set_updated_at();

-- Mail items: each piece of physical mail received for a VO member.
create table if not exists public.virtual_office_mail (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  received_at timestamptz not null default now(),
  sender text,
  label text,                          -- 'Letter', 'Package', 'Document', etc
  notes text,
  photo_url text,                      -- supabase storage path/url
  status text not null default 'received' check (status in ('received', 'forwarded', 'collected', 'discarded')),
  status_changed_at timestamptz,
  notified_at timestamptz,             -- when we emailed the member
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vo_mail_user_idx
  on public.virtual_office_mail (user_id, received_at desc);
create index if not exists vo_mail_unnotified_idx
  on public.virtual_office_mail (user_id, created_at) where notified_at is null;

drop trigger if exists vo_mail_updated_at on public.virtual_office_mail;
create trigger vo_mail_updated_at before update on public.virtual_office_mail
  for each row execute function set_updated_at();

-- RLS
alter table public.virtual_office_subscriptions enable row level security;
alter table public.virtual_office_mail enable row level security;

drop policy if exists vo_subs_user_read on public.virtual_office_subscriptions;
create policy vo_subs_user_read on public.virtual_office_subscriptions
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists vo_subs_admin_write on public.virtual_office_subscriptions;
create policy vo_subs_admin_write on public.virtual_office_subscriptions
  for all using (is_admin()) with check (is_admin());

drop policy if exists vo_mail_user_read on public.virtual_office_mail;
create policy vo_mail_user_read on public.virtual_office_mail
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists vo_mail_admin_write on public.virtual_office_mail;
create policy vo_mail_admin_write on public.virtual_office_mail
  for all using (is_admin()) with check (is_admin());

-- Compliance documents uploaded at Virtual Office signup. Stored in a
-- private Supabase Storage bucket ('virtual-office-docs'); only the
-- bucket-relative path lives in this table. Admin reviews each upload
-- before the subscription is fully verified.
create table if not exists public.virtual_office_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in (
    'government_id',
    'business_registration',
    'proof_of_address',
    'other'
  )),
  storage_path text not null,
  original_filename text,
  mime_type text,
  size_bytes integer,
  status text not null default 'pending' check (status in (
    'pending',
    'approved',
    'rejected'
  )),
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  label text,
  uploaded_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Re-apply for existing databases.
alter table public.virtual_office_documents drop constraint if exists virtual_office_documents_kind_check;
alter table public.virtual_office_documents
  add constraint virtual_office_documents_kind_check check (
    kind in ('government_id','business_registration','proof_of_address','other')
  );
alter table public.virtual_office_documents
  add column if not exists label text,
  add column if not exists uploaded_by_admin boolean not null default false;

-- One latest doc per (user, kind). We don't constrain at the DB layer
-- because old/superseded uploads stay around for audit; the app filters
-- to "latest per kind" on read.
create index if not exists vo_docs_user_kind_idx
  on public.virtual_office_documents (user_id, kind, created_at desc);
create index if not exists vo_docs_pending_idx
  on public.virtual_office_documents (created_at desc) where status = 'pending';

drop trigger if exists vo_docs_updated_at on public.virtual_office_documents;
create trigger vo_docs_updated_at before update on public.virtual_office_documents
  for each row execute function set_updated_at();

alter table public.virtual_office_documents enable row level security;

drop policy if exists vo_docs_user_read on public.virtual_office_documents;
create policy vo_docs_user_read on public.virtual_office_documents
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists vo_docs_user_insert on public.virtual_office_documents;
create policy vo_docs_user_insert on public.virtual_office_documents
  for insert with check (auth.uid() = user_id);

drop policy if exists vo_docs_admin_write on public.virtual_office_documents;
create policy vo_docs_admin_write on public.virtual_office_documents
  for update using (is_admin()) with check (is_admin());

drop policy if exists vo_docs_admin_delete on public.virtual_office_documents;
create policy vo_docs_admin_delete on public.virtual_office_documents
  for delete using (is_admin());

-- =====================================================================
-- Check-in: paired kiosk devices + visit log
-- =====================================================================

-- Tablets the manager uses for check-in. An admin pairs the device once,
-- which sets a cookie carrying the device_id. The server cross-checks the
-- device_id against this table on every check-in.
create table if not exists public.checkin_devices (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  paired_by uuid references public.profiles(id),
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checkin_devices_active_idx
  on public.checkin_devices (id) where revoked_at is null;

drop trigger if exists checkin_devices_updated_at on public.checkin_devices;
create trigger checkin_devices_updated_at before update on public.checkin_devices
  for each row execute function set_updated_at();

-- Every check-in (member, guest, tour) lands here. Members reference
-- profiles; guests carry inline contact info.
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  guest_name text,
  guest_email text,
  guest_phone text,
  host_user_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('member', 'guest', 'tour')),
  reason text,
  pass_purchase_id uuid references public.pass_purchases(id) on delete set null,
  device_id uuid references public.checkin_devices(id) on delete set null,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  notes text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A member visit must have user_id, a guest visit must have a name.
  constraint visit_member_has_user check (
    kind <> 'member' or user_id is not null
  ),
  constraint visit_guest_has_name check (
    kind = 'member' or (guest_name is not null and length(guest_name) > 0)
  )
);

-- Guests accept the T&Cs as part of check-in (added Jul 2026).
alter table public.visits add column if not exists terms_accepted_at timestamptz;

create index if not exists visits_user_idx
  on public.visits (user_id, checked_in_at desc);
create index if not exists visits_active_idx
  on public.visits (checked_in_at desc) where checked_out_at is null;
create index if not exists visits_kind_idx
  on public.visits (kind, checked_in_at desc);

drop trigger if exists visits_updated_at on public.visits;
create trigger visits_updated_at before update on public.visits
  for each row execute function set_updated_at();

-- Visitor selfie (path inside the visitor-photos storage bucket).
alter table public.visits add column if not exists selfie_path text;

-- RLS
alter table public.checkin_devices enable row level security;
alter table public.visits enable row level security;

drop policy if exists checkin_devices_admin_all on public.checkin_devices;
create policy checkin_devices_admin_all on public.checkin_devices
  for all using (is_admin()) with check (is_admin());

drop policy if exists visits_user_read_own on public.visits;
create policy visits_user_read_own on public.visits
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists visits_admin_write on public.visits;
create policy visits_admin_write on public.visits
  for all using (is_admin()) with check (is_admin());

-- Enable realtime on visits so the admin mission-control view (/admin)
-- can subscribe to new check-ins as they happen. `alter publication`
-- errors if the table is already a member, so wrap in a do-block.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'visits'
  ) then
    alter publication supabase_realtime add table public.visits;
  end if;
end$$;

-- REPLICA IDENTITY FULL: without this, Postgres only sends the primary
-- key in the replication stream. Realtime then evaluates the
-- visits_user_read_own RLS policy against a row that's missing user_id,
-- so the broadcast is silently denied. With FULL, the whole row is
-- shipped and RLS can correctly evaluate `auth.uid() = user_id or
-- is_admin()`. Slightly more bytes per insert but it's a small table
-- with rare writes.
alter table public.visits replica identity full;

-- =====================================================================
-- reception_status: a single current-status row for the front desk.
--
-- The receptionist taps an options button on the paired iPad kiosk to set
-- "Be Right Back" with a reason and a duration; visitors still self
-- check-in underneath the status banner. The /admin mission-control view
-- also reads this so admins can see when the desk is unattended.
--
-- We keep exactly one logical row, addressed by a fixed singleton id, so the
-- kiosk and admin always read/write the same record. Writes happen
-- server-side via the service-role client (after a paired-device check), so
-- there is no public write policy — only a public read policy, since the
-- kiosk has a device cookie but no Supabase user session.
-- =====================================================================
create table if not exists public.reception_status (
  -- Fixed singleton id. There is only ever one front desk.
  id uuid primary key default '00000000-0000-0000-0000-000000000001',
  is_away boolean not null default false,
  reason_id text,
  message text,
  away_since timestamptz,
  return_at timestamptz,
  set_by_device_id uuid references public.checkin_devices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Belt-and-braces: only the singleton id is allowed, so we can never grow
  -- a second competing status row.
  constraint reception_status_singleton
    check (id = '00000000-0000-0000-0000-000000000001'),
  -- When away, we expect a reason + timing; when present, those are cleared.
  constraint reception_status_away_shape check (
    (is_away = false)
    or (reason_id is not null and away_since is not null and return_at is not null)
  )
);

-- Seed the singleton row in the "at the desk" state.
insert into public.reception_status (id, is_away)
values ('00000000-0000-0000-0000-000000000001', false)
on conflict (id) do nothing;

drop trigger if exists reception_status_updated_at on public.reception_status;
create trigger reception_status_updated_at before update on public.reception_status
  for each row execute function set_updated_at();

alter table public.reception_status enable row level security;

-- Anyone can read the current status. The kiosk banner has no user session
-- (only a device cookie), and the status itself is non-sensitive ("the desk
-- is at lunch"), so a public read policy is the simplest correct choice.
drop policy if exists reception_status_public_read on public.reception_status;
create policy reception_status_public_read on public.reception_status
  for select using (true);

-- Only admins can write through the anon/auth API surface. The kiosk routes
-- write with the service-role client (which bypasses RLS) after verifying the
-- paired-device cookie, so they don't rely on this policy.
drop policy if exists reception_status_admin_write on public.reception_status;
create policy reception_status_admin_write on public.reception_status
  for all using (is_admin()) with check (is_admin());

-- Realtime: both the kiosk banner and the /admin view subscribe so the
-- status flips live without a refresh. Mirror the visits table setup.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'reception_status'
  ) then
    alter publication supabase_realtime add table public.reception_status;
  end if;
end$$;

-- REPLICA IDENTITY FULL so the realtime stream ships the whole row (not just
-- the PK), letting the public-read RLS policy evaluate correctly. Tiny table,
-- rare writes — the extra bytes are immaterial.
alter table public.reception_status replica identity full;

-- =====================================================================
-- Referrals: peer-to-peer member acquisition with two-sided rewards.
--
-- Flow:
--   1. Each member has a stable profiles.referral_code (lazily generated
--      when they visit /dashboard/refer).
--   2. Friend opens theworx.io/r/<code> → cookie set, redirect to /sign-up.
--   3. Friend completes onboarding → insert referrals row (status =
--      'signed_up', referred_user_id = friend.id, referrer_id = member.id).
--   4. Friend makes their first paid pass or subscription → webhook flips
--      status to 'qualified' and grants a Day Pass to BOTH parties.
--      Reward grant idempotent via unique (referred_user_id) constraint.
-- =====================================================================
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid unique references public.profiles(id) on delete set null,
  code text not null,
  status text not null default 'signed_up' check (status in (
    'signed_up',
    'qualified',
    'rewarded',
    'expired',
    'voided'
  )),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  referrer_reward_pass_id uuid references public.pass_purchases(id) on delete set null,
  referred_reward_pass_id uuid references public.pass_purchases(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referrals_referrer_idx
  on public.referrals (referrer_id, created_at desc);
create index if not exists referrals_status_idx
  on public.referrals (status) where status in ('signed_up', 'qualified');

drop trigger if exists referrals_updated_at on public.referrals;
create trigger referrals_updated_at before update on public.referrals
  for each row execute function set_updated_at();

alter table public.referrals enable row level security;

drop policy if exists referrals_user_read on public.referrals;
create policy referrals_user_read on public.referrals
  for select using (
    auth.uid() = referrer_id
    or auth.uid() = referred_user_id
    or is_admin()
  );

drop policy if exists referrals_admin_write on public.referrals;
create policy referrals_admin_write on public.referrals
  for all using (is_admin()) with check (is_admin());

-- =====================================================================
-- Account credits: TTD store-credit balance per member.
--
-- Two tables:
--   credit_grants — the money you've given. One row per grant. Carries
--     the reason + reference + expiry. Source of truth for issuance.
--   credit_ledger — every credit (+) and debit (-) applied to a user's
--     balance, with running balance for fast lookup. Audit trail.
--
-- A member's current balance is the latest credit_ledger.balance_after
-- for that user (or 0 if no rows). Grants insert a +credit row; redemptions
-- insert a -debit row tied to a payments.id.
--
-- Unclaimed grants (recipient hasn't signed up yet) have user_id=null
-- and a recipient_email; a trigger attaches them when the matching
-- profile is created.
-- =====================================================================
create table if not exists public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  recipient_email text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'TTD',
  reason text not null check (reason in (
    'closure_compensation',
    'refund_as_credit',
    'goodwill',
    'referral',
    'other'
  )),
  reason_note text,
  expires_at timestamptz not null,
  issued_by uuid references public.profiles(id),
  attached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A grant must either be attached to a user or carry an email so it
  -- can be attached later.
  constraint credit_grants_target_check check (
    user_id is not null or recipient_email is not null
  )
);

create index if not exists credit_grants_user_idx
  on public.credit_grants (user_id) where user_id is not null;
create index if not exists credit_grants_email_idx
  on public.credit_grants (lower(recipient_email)) where user_id is null;
create index if not exists credit_grants_expires_idx
  on public.credit_grants (expires_at);

drop trigger if exists credit_grants_updated_at on public.credit_grants;
create trigger credit_grants_updated_at before update on public.credit_grants
  for each row execute function set_updated_at();

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  grant_id uuid references public.credit_grants(id) on delete set null,
  -- Positive = credit added, negative = credit used.
  amount_cents integer not null,
  balance_after_cents integer not null check (balance_after_cents >= 0),
  reason text not null,
  payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx
  on public.credit_ledger (user_id, created_at desc);

-- RLS
alter table public.credit_grants enable row level security;
alter table public.credit_ledger enable row level security;

drop policy if exists credit_grants_user_read on public.credit_grants;
create policy credit_grants_user_read on public.credit_grants
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists credit_grants_admin_write on public.credit_grants;
create policy credit_grants_admin_write on public.credit_grants
  for all using (is_admin()) with check (is_admin());

drop policy if exists credit_ledger_user_read on public.credit_ledger;
create policy credit_ledger_user_read on public.credit_ledger
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists credit_ledger_admin_write on public.credit_ledger;
create policy credit_ledger_admin_write on public.credit_ledger
  for all using (is_admin()) with check (is_admin());

-- Attach unclaimed credit grants when a profile is created with the
-- matching email. Fires on profiles INSERT.
create or replace function public.attach_unclaimed_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  grant_row public.credit_grants;
  current_balance integer;
begin
  -- Get current balance (latest ledger row for this user, or 0).
  select coalesce(
    (select balance_after_cents from public.credit_ledger
     where user_id = new.id order by created_at desc limit 1),
    0
  ) into current_balance;

  for grant_row in
    select * from public.credit_grants
    where user_id is null
      and lower(recipient_email) = lower(new.email)
      and expires_at > now()
  loop
    update public.credit_grants
      set user_id = new.id, attached_at = now()
      where id = grant_row.id;
    current_balance := current_balance + grant_row.amount_cents;
    insert into public.credit_ledger
      (user_id, grant_id, amount_cents, balance_after_cents, reason)
    values
      (new.id, grant_row.id, grant_row.amount_cents, current_balance,
       'grant attached on signup');
  end loop;
  return new;
end;
$$;

drop trigger if exists attach_unclaimed_credits_trigger on public.profiles;
create trigger attach_unclaimed_credits_trigger
  after insert on public.profiles
  for each row execute function public.attach_unclaimed_credits();

-- =====================================================================
-- Resources: tiered hourly pricing + admin-only bookability.
--
-- after_hours_price_per_hour_cents takes over at after_hours_starts_at_hour
-- (AST). Useful for venues where evening usage is priced differently —
-- e.g., Main Space at $250/hr 9am-5pm and $500/hr 5pm-11pm.
--
-- admin_only hides a resource from the public booking surface but
-- keeps it bookable from /admin/bookings/new. Useful for spaces like
-- private offices that we book ad-hoc when not under contract.
-- =====================================================================
alter table public.resources
  add column if not exists after_hours_price_per_hour_cents integer,
  add column if not exists after_hours_starts_at_hour integer,
  add column if not exists admin_only boolean not null default false;

-- Main Space: bookable 9am-11pm, $250/hr regular, $500/hr after 5pm.
insert into public.resources (
  id, name, description, kind, capacity,
  price_per_hour_cents, after_hours_price_per_hour_cents, after_hours_starts_at_hour,
  open_hour, close_hour, slot_minutes, is_bookable, requires_contact, admin_only, display_order
) values (
  'main-space',
  'Main Space',
  'The Worx main floor as a bookable venue. Regular hours 9am-5pm at TTD $250/hr; after-hours rate of TTD $500/hr applies for slots starting at 5pm or later.',
  'event-space', 50,
  25000, 50000, 17,
  9, 23, 60, true, false, false, 25
) on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  capacity = excluded.capacity,
  price_per_hour_cents = excluded.price_per_hour_cents,
  after_hours_price_per_hour_cents = excluded.after_hours_price_per_hour_cents,
  after_hours_starts_at_hour = excluded.after_hours_starts_at_hour,
  open_hour = excluded.open_hour,
  close_hour = excluded.close_hour,
  slot_minutes = excluded.slot_minutes,
  is_bookable = excluded.is_bookable,
  requires_contact = excluded.requires_contact,
  admin_only = excluded.admin_only,
  display_order = excluded.display_order;

-- Private Office and Corner Office as admin-bookable resources for
-- ad-hoc rentals when they're not under monthly contract. Pricing
-- mirrors a normal hourly room — admin can override on the form.
insert into public.resources (
  id, name, description, kind, capacity,
  price_per_hour_cents,
  open_hour, close_hour, slot_minutes, is_bookable, requires_contact, admin_only, display_order
) values
  ('private-office',
   'Private Office',
   'Private office available for ad-hoc booking when not under monthly contract. Hourly rate is a placeholder — admin can override on the form.',
   'meeting-room', 6, 30000, 8, 20, 60, true, false, true, 40),
  ('corner-office',
   'Corner Office',
   'Corner office suite available for ad-hoc booking when not under monthly contract. Hourly rate is a placeholder — admin can override on the form.',
   'meeting-room', 8, 40000, 8, 20, 60, true, false, true, 41)
on conflict (id) do update set
  description = excluded.description,
  is_bookable = excluded.is_bookable,
  admin_only = excluded.admin_only,
  display_order = excluded.display_order;

-- =====================================================================
-- Mission control: upcoming bookings + count.
--
-- PostgREST string-range comparison on a tstzrange column doesn't behave
-- as expected ("gte('during', '[ts,)')" treats the literal as a range
-- and applies range comparison, not "lower(during) >= ts"). Two helper
-- functions return the data the dashboard actually wants in one shot
-- with the right semantics + the joins inline so admin doesn't have to
-- manually unpack PostgREST FK arrays.
-- =====================================================================
create or replace function public.admin_upcoming_bookings(within_hours int default 2)
returns table (
  id uuid,
  during text,
  user_id uuid,
  resource_id text,
  status text,
  full_name text,
  email text,
  guest_name text,
  resource_name text
)
language sql
security definer
set search_path = public
as $$
  select b.id,
         b.during::text,
         b.user_id,
         b.resource_id,
         b.status,
         p.full_name,
         p.email,
         b.guest_name,
         r.name as resource_name
  from public.bookings b
  left join public.profiles p on p.id = b.user_id
  left join public.resources r on r.id = b.resource_id
  where b.status in ('confirmed','held')
    and lower(b.during) >= now()
    and lower(b.during) <= now() + (within_hours || ' hours')::interval
  order by lower(b.during) asc
  limit 12;
$$;

revoke all on function public.admin_upcoming_bookings(int) from public;
grant execute on function public.admin_upcoming_bookings(int) to authenticated, service_role;

create or replace function public.admin_upcoming_bookings_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from public.bookings
  where status in ('confirmed','held')
    and lower(during) >= now();
$$;

revoke all on function public.admin_upcoming_bookings_count() from public;
grant execute on function public.admin_upcoming_bookings_count() to authenticated, service_role;

-- =====================================================================
-- Backfill: any auth.users without a profile row gets one. Catches users
-- created before the handle_new_user trigger was attached.
-- =====================================================================
insert into public.profiles (id, email, full_name)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and u.email is not null;

-- =====================================================================
-- Packages & operations upgrades (Jul 2026): discount labels on
-- plans/passes, manual paid flag on bookings, expanded designations,
-- and the in-app member notification system.
-- =====================================================================
alter table public.plans add column if not exists discount_label text;
alter table public.passes add column if not exists discount_label text;
alter table public.bookings add column if not exists paid_at timestamptz;

alter table public.profiles drop constraint if exists profiles_designation_check;
alter table public.profiles add constraint profiles_designation_check
  check (designation is null or designation in
    ('staff','investor','community_contributor','wam_staff','wam_investor','associate','office_rental'));

create table if not exists public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  -- null user_id = broadcast to every member
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists member_notifications_user_idx
  on public.member_notifications (user_id, created_at desc);

create table if not exists public.member_notification_reads (
  notification_id uuid not null references public.member_notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.member_notifications enable row level security;
alter table public.member_notification_reads enable row level security;

drop policy if exists "members read own or broadcast notifications" on public.member_notifications;
create policy "members read own or broadcast notifications"
  on public.member_notifications for select
  using (user_id = auth.uid() or user_id is null);

drop policy if exists "members read own notification reads" on public.member_notification_reads;
create policy "members read own notification reads"
  on public.member_notification_reads for select
  using (user_id = auth.uid());

drop policy if exists "members mark own notifications read" on public.member_notification_reads;
create policy "members mark own notifications read"
  on public.member_notification_reads for insert
  with check (user_id = auth.uid());

-- Re-apply: admin_bookings_list now also returns payment_id, paid_at and
-- checked_in_at so the admin list can show paid + arrival state.
drop function if exists public.admin_bookings_list(text, text, integer);
create or replace function public.admin_bookings_list(when_filter text, status_filter text default null::text, row_limit integer default 100)
 returns table(id uuid, during text, status text, price_cents integer, user_id uuid, guest_name text, guest_email text, resource_id text, resource_name text, full_name text, email text, notes text, payment_id uuid, paid_at timestamptz, checked_in_at timestamptz, booking_group_id uuid)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  lo timestamptz;
  hi timestamptz;
  asc_order boolean := true;
  ast_today_start timestamptz := (date_trunc('day', (now() at time zone 'America/Port_of_Spain')) at time zone 'America/Port_of_Spain');
begin
  if when_filter = 'today' then
    lo := ast_today_start;
    hi := ast_today_start + interval '1 day';
  elsif when_filter = 'week' then
    lo := ast_today_start;
    hi := ast_today_start + interval '7 days';
  elsif when_filter = 'upcoming' then
    lo := now();
  elsif when_filter = 'past' then
    hi := now();
    asc_order := false;
  end if;

  return query
  select b.id,
         b.during::text,
         b.status,
         b.price_cents,
         b.user_id,
         b.guest_name,
         b.guest_email,
         b.resource_id,
         r.name as resource_name,
         p.full_name,
         p.email,
         b.notes,
         b.payment_id,
         b.paid_at,
         b.checked_in_at,
         b.booking_group_id
  from public.bookings b
  left join public.resources r on r.id = b.resource_id
  left join public.profiles p on p.id = b.user_id
  where (status_filter is null or b.status = status_filter)
    and (lo is null or lower(b.during) >= lo)
    and (hi is null or lower(b.during) < hi)
  order by
    case when asc_order then lower(b.during) end asc nulls last,
    case when not asc_order then lower(b.during) end desc nulls last
  limit row_limit;
end;
$function$;
revoke all on function public.admin_bookings_list(text, text, integer) from public;
grant execute on function public.admin_bookings_list(text, text, integer) to authenticated, service_role;

-- Two-way messages: members can write back to the team. sender marks
-- who authored the row; the insert policy lets members create only
-- their own 'member'-sent messages.
alter table public.member_notifications
  add column if not exists sender text not null default 'team'
  check (sender in ('team','member'));
drop policy if exists "members send messages to the team" on public.member_notifications;
create policy "members send messages to the team"
  on public.member_notifications for insert
  with check (user_id = auth.uid() and sender = 'member');

-- Private packages: management-only products. Hidden from /spaces, /buy
-- and self-serve checkout; still available in the admin payment recorder.
alter table public.plans add column if not exists is_private boolean not null default false;
alter table public.passes add column if not exists is_private boolean not null default false;

-- Designations are now data-driven: roles live in designation_roles so
-- management can create/rename tiers without a deploy. profiles.designation
-- switches from a CHECK enum to a FK; deleting a role in use is refused.
create table if not exists public.designation_roles (
  id text primary key,
  label text not null,
  created_at timestamptz not null default now()
);
insert into public.designation_roles (id, label) values
  ('staff', 'Worx Staff'),
  ('investor', 'Investor'),
  ('community_contributor', 'Community Contributor'),
  ('wam_staff', 'Wam Staff'),
  ('wam_investor', 'Wam Investor'),
  ('associate', 'Associate'),
  ('office_rental', 'Office Rental')
on conflict (id) do nothing;
alter table public.profiles drop constraint if exists profiles_designation_check;
alter table public.profiles drop constraint if exists profiles_designation_fkey;
alter table public.profiles add constraint profiles_designation_fkey
  foreign key (designation) references public.designation_roles(id);
alter table public.designation_roles enable row level security;
drop policy if exists "anyone can read designation roles" on public.designation_roles;
create policy "anyone can read designation roles"
  on public.designation_roles for select using (true);

-- Message groups: named member lists for targeted sends from the admin
-- Messages tab. Admin-only (service role); RLS enabled with no member
-- policies so members can't see group composition.
create table if not exists public.message_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.message_group_members (
  group_id uuid not null references public.message_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (group_id, user_id)
);
alter table public.message_groups enable row level security;
alter table public.message_group_members enable row level security;

-- Plan room benefits: plans can include monthly meeting/conference room
-- hours (with optional per-day caps). Covered bookings are stamped so
-- monthly usage can be computed.
alter table public.plans add column if not exists room_benefits jsonb not null default '[]'::jsonb;
alter table public.bookings add column if not exists covered_by_plan boolean not null default false;

-- Room-hour credits: one-off grants of free room time (e.g. "5 hours on
-- the conference room"). Consumed by the booking checkout after plan
-- benefits. Plus: plans can exclude daily workspace access (a plan that
-- only sells room hours shouldn't grant free daily check-in), and desk
-- resources so plans can name hot/dedicated desk access.
create table if not exists public.room_hour_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_id text not null references public.resources(id),
  hours_granted numeric not null check (hours_granted > 0),
  hours_used numeric not null default 0 check (hours_used >= 0),
  reason text,
  expires_at timestamptz,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists room_hour_credits_user_idx
  on public.room_hour_credits (user_id, resource_id);
alter table public.room_hour_credits enable row level security;
drop policy if exists "members read own room hour credits" on public.room_hour_credits;
create policy "members read own room hour credits"
  on public.room_hour_credits for select using (user_id = auth.uid());

alter table public.plans add column if not exists includes_day_access boolean not null default true;

insert into public.resources (id, name, description, kind, capacity, currency, open_hour, close_hour, slot_minutes, is_bookable, admin_only, display_order)
values
  ('hot-desk', 'Hot Desk', 'Open coworking floor seating.', 'hot-desk', 1, 'TTD', 8, 20, 60, false, false, 90),
  ('dedicated-desk', 'Dedicated Desk', 'A reserved desk of their own.', 'hot-desk', 1, 'TTD', 8, 20, 60, false, false, 91)
on conflict (id) do nothing;

-- Group packages + member add-ons + payment requests (Jul 27):
-- group_size marks plans/passes as group products and bookings as
-- group bookings (kiosk check-in counts arrivals up to the size);
-- member_addons are per-member recurring extras charged with the plan.
alter table public.passes add column if not exists group_size integer check (group_size is null or group_size between 2 and 50);
alter table public.plans add column if not exists group_size integer check (group_size is null or group_size between 2 and 50);
alter table public.bookings add column if not exists group_size integer check (group_size is null or group_size between 2 and 50);
alter table public.bookings add column if not exists checkin_count integer not null default 0;

create table if not exists public.member_addons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  amount_cents integer not null check (amount_cents >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists member_addons_user_idx on public.member_addons (user_id);
alter table public.member_addons enable row level security;
drop policy if exists "members read own addons" on public.member_addons;
create policy "members read own addons"
  on public.member_addons for select using (user_id = auth.uid());

-- Group membership check-in: guests checking in on a member's group
-- plan/pass are linked to the host via visits.host_user_id so daily
-- headcounts are countable. Add-ons can now expire (timed periods).
alter table public.visits add column if not exists host_user_id uuid references public.profiles(id) on delete set null;
create index if not exists visits_host_idx on public.visits (host_user_id, checked_in_at desc);
alter table public.member_addons add column if not exists expires_at timestamptz;

-- Discount codes: percent-off codes applicable to specific plans/passes
-- (empty applies_to = everything), with optional per-member use limits
-- and expiry. Uses are counted from payments metadata, no uses table.
create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percent_off integer not null check (percent_off between 1 and 100),
  applies_to jsonb not null default '[]'::jsonb,
  max_uses_per_member integer check (max_uses_per_member is null or max_uses_per_member >= 1),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.discount_codes enable row level security;

-- Credit as a first-class payment method: online checkout and bookings
-- auto-apply account credit when it covers the full price.
alter table public.payments drop constraint if exists payments_payment_method_check;
alter table public.payments add constraint payments_payment_method_check
  check (payment_method is null or payment_method in ('wam_online','wam_pos','cash','bank_transfer','credit','other'));

-- Official invoices: numbered, line-itemed, tied to a pending payment
-- with an embedded Wam pay link. A monthly cron auto-invoices office
-- renters and virtual-office holders; admins can also invoice manually.
create sequence if not exists public.invoice_number_seq;
create or replace function public.next_invoice_number()
returns text
language sql
security definer
set search_path = public
as $$
  select 'WORX-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
$$;
revoke all on function public.next_invoice_number() from public;
grant execute on function public.next_invoice_number() to service_role;

-- A legacy Nexudus-era invoices table (no `kind` column, never populated)
-- predates this feature; drop that shape so the real one can be created.
do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'invoices'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoices' and column_name = 'kind'
  ) then
    drop table public.invoices;
  end if;
end $$;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  kind text not null check (kind in ('virtual_office','office_rental','membership','booking','other')),
  line_items jsonb not null default '[]'::jsonb,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'TTD',
  period_label text,
  due_at timestamptz,
  sent_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists invoices_user_idx on public.invoices (user_id, created_at desc);
alter table public.invoices enable row level security;
drop policy if exists "members read own invoices" on public.invoices;
create policy "members read own invoices"
  on public.invoices for select using (user_id = auth.uid());

-- ============================================================
-- August 2026 manager batch: financial tracker, member requests,
-- feedback forms, welcome pack, specialized catalog labels.
-- ============================================================

-- Financial tracker: one-off and recurring expenses.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  category text not null default 'general',
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'TTD',
  is_recurring boolean not null default false,
  incurred_on date,
  starts_on date,
  ends_on date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.expenses enable row level security;

-- Member plan requests: pause / deactivate / reactivate, surfaced to admins.
create table if not exists public.member_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('pause','deactivate','reactivate')),
  note text,
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now(),
  actioned_by uuid references public.profiles(id) on delete set null,
  actioned_at timestamptz
);
alter table public.member_requests enable row level security;
drop policy if exists "members read own requests" on public.member_requests;
create policy "members read own requests"
  on public.member_requests for select using (user_id = auth.uid());

-- Quarterly feedback forms + responses.
create table if not exists public.feedback_forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  intro text,
  questions jsonb not null default '[]'::jsonb,
  is_open boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.feedback_forms enable row level security;
drop policy if exists "members read open forms" on public.feedback_forms;
create policy "members read open forms"
  on public.feedback_forms for select using (is_open = true);

create table if not exists public.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.feedback_forms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (form_id, user_id)
);
alter table public.feedback_responses enable row level security;

-- Welcome pack: admin-uploaded files emailed to members.
create table if not exists public.welcome_pack_files (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  storage_path text not null,
  mime_type text,
  size_bytes integer,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.welcome_pack_files enable row level security;
insert into storage.buckets (id, name, public)
  values ('welcome-pack', 'welcome-pack', false)
  on conflict (id) do nothing;

-- Specialized label on catalog items.
alter table public.plans add column if not exists is_specialized boolean not null default false;
alter table public.passes add column if not exists is_specialized boolean not null default false;

-- Reporting indexes: the finance tracker groups payments by paid_at,
-- discount-usage tallies filter payments.metadata, and member growth
-- buckets profiles.created_at.
create index if not exists payments_paid_at_idx on public.payments (paid_at desc) where status = 'succeeded';
create index if not exists payments_metadata_gin_idx on public.payments using gin (metadata);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
