-- Pinnacle Fitness — combined idempotent schema.
-- Safe to run repeatedly (create if not exists / drop policy if exists /
-- create or replace). Runs top-to-bottom on an EMPTY public schema; on the
-- old gym database run supabase/000_reset_legacy.sql first.
--
-- Money is always integer cents in TTD. Times are timestamptz; the gym runs
-- on America/Port_of_Spain (AST, no DST).

-- =====================================================================
-- Extensions
-- =====================================================================
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- =====================================================================
-- Helpers
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =====================================================================
-- profiles: 1:1 with auth.users
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  phone text,
  company text,
  role text not null default 'member'
    check (role in ('member','coach','owner','staff','admin')),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('member','coach','owner','staff','admin'));

-- Member-facing extras (kept from the platform base)
alter table public.profiles add column if not exists pincode text;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists registered_at timestamptz;
alter table public.profiles add column if not exists last_access_at timestamptz;
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists selfie_path text;
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists designation text;

-- Gym extras
alter table public.profiles add column if not exists pin_code text;            -- 4-digit kiosk fallback when the phone is dead
alter table public.profiles add column if not exists goal text;                -- from onboarding ("strength", "athletic", ...)
alter table public.profiles add column if not exists training_notes text;      -- injuries / things the coach should know
alter table public.profiles add column if not exists preferred_coach_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists experience_bracket text;
alter table public.profiles add column if not exists applied_at timestamptz;
alter table public.profiles add column if not exists approved_at timestamptz;
alter table public.profiles add column if not exists approved_by uuid references public.profiles(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_experience_bracket_check;
alter table public.profiles add constraint profiles_experience_bracket_check
  check (experience_bracket is null or experience_bracket in ('under_6m','6_24m','2y_plus'));
alter table public.profiles drop constraint if exists profiles_pin_code_check;
alter table public.profiles add constraint profiles_pin_code_check
  check (pin_code is null or pin_code ~ '^[0-9]{4}$');

create index if not exists profiles_role_idx
  on public.profiles (role) where archived = false;
create index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));
create unique index if not exists profiles_referral_code_idx
  on public.profiles (referral_code) where referral_code is not null;
create index if not exists profiles_terms_idx
  on public.profiles (terms_version) where terms_version is not null;
create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Anyone who runs the gym. 'admin' is the legacy role name the app code
-- still checks (role === 'admin'); coaches and owners are admins too.
-- TODO(code): move the app's checks to role in ('coach','owner','admin').
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('coach','owner','admin')
      and archived = false
  )
$$;

-- Front-desk staff can check people in and sell, but see no money.
create or replace function public.is_staff_or_above(uid uuid default auth.uid())
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and role in ('staff','coach','owner','admin')
      and archived = false
  )
$$;

-- Designations: a badge in admin views. Data-driven so owners can rename
-- without a deploy. Coaches/owners/staff also carry a `role`; the
-- designation is the human label shown on the kiosk staff list.
create table if not exists public.designation_roles (
  id text primary key,
  label text not null,
  created_at timestamptz not null default now()
);
insert into public.designation_roles (id, label) values
  ('coach', 'Coach'),
  ('staff', 'Front desk'),
  ('owner', 'Owner')
on conflict (id) do nothing;
alter table public.profiles drop constraint if exists profiles_designation_check;
alter table public.profiles drop constraint if exists profiles_designation_fkey;
alter table public.profiles add constraint profiles_designation_fkey
  foreign key (designation) references public.designation_roles(id);

-- =====================================================================
-- Catalog: plans (monthly memberships), passes (session packs), resources
-- (what gets booked). Prices in cents.
-- =====================================================================
create table if not exists public.plans (
  id text primary key,
  name text not null,
  description text,
  price_cents integer not null,
  discounted_price_cents integer,
  discount_expires_at timestamptz,
  discount_label text,
  currency text not null default 'TTD',
  billing_period text not null default 'month' check (billing_period in ('month','year')),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  is_private boolean not null default false,
  is_specialized boolean not null default false,
  display_order integer not null default 0,
  -- Session allowances. pt_sessions_per_month null + includes_pt = unlimited PT.
  includes_pt boolean not null default true,
  pt_sessions_per_month integer check (pt_sessions_per_month is null or pt_sessions_per_month > 0),
  includes_open_gym boolean not null default false,
  open_gym_visits_per_month integer check (open_gym_visits_per_month is null or open_gym_visits_per_month > 0),
  -- Legacy platform fields kept for code compatibility.
  room_benefits jsonb not null default '[]'::jsonb,
  includes_day_access boolean not null default true,
  group_size integer check (group_size is null or group_size between 2 and 50),
  created_at timestamptz not null default now()
);
alter table public.plans add column if not exists discount_label text;
alter table public.plans add column if not exists is_private boolean not null default false;
alter table public.plans add column if not exists is_specialized boolean not null default false;
alter table public.plans add column if not exists includes_pt boolean not null default true;
alter table public.plans add column if not exists pt_sessions_per_month integer;
alter table public.plans add column if not exists includes_open_gym boolean not null default false;
alter table public.plans add column if not exists open_gym_visits_per_month integer;
alter table public.plans add column if not exists room_benefits jsonb not null default '[]'::jsonb;
alter table public.plans add column if not exists includes_day_access boolean not null default true;
alter table public.plans add column if not exists group_size integer;

create table if not exists public.passes (
  id text primary key,
  name text not null,
  description text,
  price_cents integer not null,
  discounted_price_cents integer,
  discount_expires_at timestamptz,
  discount_label text,
  currency text not null default 'TTD',
  -- Packs: uses_total sessions of session_kind, expiring validity_days
  -- after purchase (30 = "packs expire every month").
  session_kind text not null default 'pt' check (session_kind in ('pt','open_gym')),
  uses_total integer not null,
  validity_days integer not null default 30,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  is_private boolean not null default false,
  is_specialized boolean not null default false,
  group_size integer check (group_size is null or group_size between 2 and 50),
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.passes add column if not exists discount_label text;
alter table public.passes add column if not exists session_kind text not null default 'pt';
alter table public.passes add column if not exists is_private boolean not null default false;
alter table public.passes add column if not exists is_specialized boolean not null default false;
alter table public.passes add column if not exists group_size integer;

-- Coaches: the two owners today. A coach is a profile with role 'coach'
-- or 'owner' plus this row for the public-facing bits and their group cap.
create table if not exists public.coaches (
  id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null,
  slug text not null unique,
  bio text,
  photo_path text,
  group_cap integer not null default 6 check (group_cap between 1 and 30),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists coaches_updated_at on public.coaches;
create trigger coaches_updated_at before update on public.coaches
  for each row execute function public.set_updated_at();

-- Weekly availability template, minutes since midnight so 05:30 works.
create table if not exists public.coach_availability (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_minute integer not null check (start_minute between 0 and 1439),
  end_minute integer not null check (end_minute between 1 and 1440),
  created_at timestamptz not null default now(),
  constraint coach_availability_order check (end_minute > start_minute)
);
create index if not exists coach_availability_coach_idx
  on public.coach_availability (coach_id, weekday);

-- One-off blocks ("away 12–15 Sep", "dentist Tue 10–11").
create table if not exists public.coach_blocks (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint coach_blocks_order check (ends_at > starts_at)
);
create index if not exists coach_blocks_coach_idx
  on public.coach_blocks (coach_id, starts_at);

-- Resources are what the booking engine keys on. Three rows: one PT
-- resource per coach (slot-booked, capacity = group cap) and open gym
-- (a live headcount, never slot-booked).
create table if not exists public.resources (
  id text primary key,
  name text not null,
  description text,
  kind text not null check (kind in ('pt','open_gym')),
  coach_id uuid references public.coaches(id) on delete set null,
  capacity integer not null default 1,
  price_per_hour_cents integer,
  price_per_day_cents integer,
  after_hours_price_per_hour_cents integer,
  after_hours_starts_at_hour integer,
  currency text not null default 'TTD',
  open_hour integer not null default 5,
  close_hour integer not null default 19,
  slot_minutes integer not null default 60,
  is_bookable boolean not null default true,
  requires_contact boolean not null default false,
  admin_only boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.resources add column if not exists coach_id uuid references public.coaches(id) on delete set null;
alter table public.resources add column if not exists after_hours_price_per_hour_cents integer;
alter table public.resources add column if not exists after_hours_starts_at_hour integer;
alter table public.resources add column if not exists admin_only boolean not null default false;
alter table public.resources drop constraint if exists resources_kind_check;
alter table public.resources add constraint resources_kind_check
  check (kind in ('pt','open_gym'));

-- =====================================================================
-- Subscriptions: monthly plan billing. Hard reset each period — no
-- rollover (session_ledger grants are re-issued on renewal).
-- =====================================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  plan_id text not null references public.plans(id),
  status text not null default 'active' check (status in ('active','past_due','paused','cancelled')),
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
drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Packs purchased + the audit log of every adjustment
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

-- =====================================================================
-- Payments: every Wam / cash / credit transaction
-- =====================================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete restrict,
  wam_payment_id text unique,
  amount_cents integer not null,
  currency text not null default 'TTD',
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded','cancelled')),
  kind text not null check (kind in ('subscription','pass','booking','one_time')),
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  failure_reason text,
  paid_at timestamptz,
  refunded_at timestamptz,
  payment_method text not null default 'wam_online',
  external_ref text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payments add column if not exists payment_method text not null default 'wam_online';
alter table public.payments add column if not exists external_ref text;
alter table public.payments add column if not exists recorded_by uuid references public.profiles(id);
alter table public.payments drop constraint if exists payments_payment_method_check;
alter table public.payments add constraint payments_payment_method_check
  check (payment_method is null or payment_method in ('wam_online','wam_pos','cash','bank_transfer','credit','other'));

create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_method_idx on public.payments (payment_method);
create unique index if not exists payments_external_ref_idx
  on public.payments (external_ref) where external_ref is not null;
create index if not exists payments_paid_at_idx on public.payments (paid_at desc) where status = 'succeeded';
create index if not exists payments_metadata_gin_idx on public.payments using gin (metadata);
drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Booking groups: several bookings made in one checkout, one payment.
-- Admin-on-behalf groups may be guest-attached (user_id null).
-- =====================================================================
create table if not exists public.booking_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  total_cents integer not null,
  currency text not null default 'TTD',
  status text not null default 'held' check (status in ('held','confirmed','cancelled','expired')),
  expires_at timestamptz not null,
  guest_name text,
  guest_email text,
  guest_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists booking_groups_user_idx
  on public.booking_groups (user_id, created_at desc);
create index if not exists booking_groups_held_idx
  on public.booking_groups (expires_at) where status = 'held';
drop trigger if exists booking_groups_updated_at on public.booking_groups;
create trigger booking_groups_updated_at before update on public.booking_groups
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Bookings: PT slots. Small groups overlap by design, so there is NO
-- exclusion constraint — capacity is enforced by trigger against
-- resources.capacity.
-- =====================================================================
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete restrict,
  guest_email text,
  guest_name text,
  resource_id text not null references public.resources(id),
  during tstzrange not null,
  status text not null default 'confirmed' check (status in ('held','confirmed','cancelled','completed','no_show')),
  price_cents integer not null,
  payment_id uuid references public.payments(id) on delete set null,
  pass_purchase_id uuid references public.pass_purchases(id),
  booking_group_id uuid references public.booking_groups(id) on delete set null,
  notes text,
  checked_in_at timestamptz,
  paid_at timestamptz,
  covered_by_plan boolean not null default false,
  group_size integer check (group_size is null or group_size between 2 and 50),
  checkin_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_identity_check check (
    (user_id is not null) or (guest_email is not null and guest_name is not null)
  )
);
alter table public.bookings drop constraint if exists bookings_no_overlap;
create index if not exists bookings_resource_during_idx
  on public.bookings using gist (resource_id, during);
create index if not exists bookings_user_idx
  on public.bookings (user_id, lower(during) desc) where user_id is not null;
create index if not exists bookings_group_idx
  on public.bookings (booking_group_id) where booking_group_id is not null;
drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- Capacity: reject when overlapping live bookings on the resource would
-- exceed its capacity. Each booking row counts as one person (a booking
-- with group_size counts group_size).
create or replace function public.bookings_enforce_capacity()
returns trigger language plpgsql as $$
declare
  cap integer;
  taken integer;
begin
  if new.status not in ('held','confirmed') then
    return new;
  end if;
  select capacity into cap from public.resources where id = new.resource_id;
  if cap is null then
    raise exception 'unknown resource %', new.resource_id;
  end if;
  select coalesce(sum(coalesce(b.group_size, 1)), 0) into taken
  from public.bookings b
  where b.resource_id = new.resource_id
    and b.status in ('held','confirmed')
    and b.during && new.during
    and b.id <> new.id;
  if taken + coalesce(new.group_size, 1) > cap then
    raise exception 'resource % is full for that time (capacity %)', new.resource_id, cap
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists bookings_capacity on public.bookings;
create trigger bookings_capacity before insert or update of during, status, group_size, resource_id
  on public.bookings for each row execute function public.bookings_enforce_capacity();

-- =====================================================================
-- Invoices: numbered billing documents backed by a pending payment
-- =====================================================================
create sequence if not exists public.invoice_number_seq;
create or replace function public.next_invoice_number()
returns text
language sql
security definer
set search_path = public
as $$
  select 'PIN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
$$;
revoke all on function public.next_invoice_number() from public;
grant execute on function public.next_invoice_number() to service_role;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  kind text not null check (kind in ('membership','pack','shop','other')),
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

-- =====================================================================
-- Session ledger: the source of truth for "7 sessions left". Every grant
-- (+) and use (−) is a row; balance_after is denormalised for display.
-- Pack grants carry expires_at; session_balance() ignores expired grants.
-- =====================================================================
create table if not exists public.session_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('pt','open_gym')),
  delta integer not null check (delta <> 0),
  balance_after integer,
  reason text not null check (reason in (
    'plan_grant','pack_purchase','booking_use','checkin_use',
    'no_show','late_cancel','refund','expiry','admin_adjust'
  )),
  booking_id uuid references public.bookings(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  pass_purchase_id uuid references public.pass_purchases(id) on delete set null,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists session_ledger_user_idx
  on public.session_ledger (user_id, kind, created_at desc);
create index if not exists session_ledger_booking_idx
  on public.session_ledger (booking_id) where booking_id is not null;

-- Live balance: positive grants that haven't expired, minus all uses.
-- (Uses are never "expired" — they were already spent.)
create or replace function public.session_balance(uid uuid, session_kind text)
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(delta), 0)::int
  from public.session_ledger
  where user_id = uid
    and kind = session_kind
    and (delta < 0 or expires_at is null or expires_at > now());
$$;
revoke all on function public.session_balance(uuid, text) from public;
grant execute on function public.session_balance(uuid, text) to authenticated, service_role;

-- =====================================================================
-- Settings: one row per key. Owner-editable numbers the app reads.
-- =====================================================================
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
drop trigger if exists settings_updated_at on public.settings;
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

insert into public.settings (key, value) values
  ('floor_cap', '20'::jsonb),                       -- people on the turf at once
  ('auto_signout_hours', '3'::jsonb),               -- forgot-to-scan-out safety
  ('pt_cancel_hours', '4'::jsonb),                  -- free cancel window before a PT slot
  ('no_show_minutes', '60'::jsonb),                 -- minutes after slot start before a no-show is charged
  ('rent_target_cents', '0'::jsonb),                -- monthly pool target; owners set it
  ('opening_hours', '{
     "0": null,
     "1": {"open": "05:30", "close": "19:00"},
     "2": {"open": "05:30", "close": "19:00"},
     "3": {"open": "05:30", "close": "19:00"},
     "4": {"open": "05:30", "close": "19:00"},
     "5": {"open": "05:30", "close": "19:00"},
     "6": {"open": "07:00", "close": "13:00"}
   }'::jsonb)
on conflict (key) do nothing;

-- =====================================================================
-- Check-in: paired iPad kiosks + the visit log (the door)
-- =====================================================================
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
  for each row execute function public.set_updated_at();

-- Every scan lands here. kind 'pt' = arrived for a coached slot,
-- 'open_gym' = using the floor. Open visits (checked_out_at null) are
-- what the floor cap counts.
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  guest_name text,
  guest_email text,
  guest_phone text,
  host_user_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('member','guest','tour','pt','open_gym')),
  reason text,
  pass_purchase_id uuid references public.pass_purchases(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  device_id uuid references public.checkin_devices(id) on delete set null,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  notes text,
  terms_accepted_at timestamptz,
  selfie_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visit_member_has_user check (
    kind not in ('member','pt','open_gym') or user_id is not null or host_user_id is not null
  ),
  constraint visit_guest_has_name check (
    kind in ('member','pt','open_gym') or (guest_name is not null and length(guest_name) > 0)
  )
);
alter table public.visits add column if not exists booking_id uuid references public.bookings(id) on delete set null;
alter table public.visits add column if not exists host_user_id uuid references public.profiles(id) on delete set null;
alter table public.visits add column if not exists terms_accepted_at timestamptz;
alter table public.visits add column if not exists selfie_path text;
alter table public.visits drop constraint if exists visits_kind_check;
alter table public.visits add constraint visits_kind_check
  check (kind in ('member','guest','tour','pt','open_gym'));

create index if not exists visits_user_idx on public.visits (user_id, checked_in_at desc);
create index if not exists visits_active_idx on public.visits (checked_in_at desc) where checked_out_at is null;
create index if not exists visits_open_idx on public.visits (checked_out_at) where checked_out_at is null;
create index if not exists visits_kind_idx on public.visits (kind, checked_in_at desc);
create index if not exists visits_host_idx on public.visits (host_user_id, checked_in_at desc);
drop trigger if exists visits_updated_at on public.visits;
create trigger visits_updated_at before update on public.visits
  for each row execute function public.set_updated_at();

-- Who's on the turf right now. Guests count too — they're bodies on the floor.
create or replace function public.floor_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from public.visits
  where checked_out_at is null
    and kind in ('member','guest','pt','open_gym');
$$;
revoke all on function public.floor_count() from public;
grant execute on function public.floor_count() to anon, authenticated, service_role;

-- Front desk "Be Right Back" singleton.
create table if not exists public.reception_status (
  id uuid primary key default '00000000-0000-0000-0000-000000000001',
  is_away boolean not null default false,
  reason_id text,
  message text,
  away_since timestamptz,
  return_at timestamptz,
  set_by_device_id uuid references public.checkin_devices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reception_status_singleton
    check (id = '00000000-0000-0000-0000-000000000001'),
  constraint reception_status_away_shape check (
    (is_away = false)
    or (reason_id is not null and away_since is not null and return_at is not null)
  )
);
insert into public.reception_status (id, is_away)
values ('00000000-0000-0000-0000-000000000001', false)
on conflict (id) do nothing;
drop trigger if exists reception_status_updated_at on public.reception_status;
create trigger reception_status_updated_at before update on public.reception_status
  for each row execute function public.set_updated_at();

-- =====================================================================
-- CRM + email plumbing
-- =====================================================================
create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_notes_user_idx on public.admin_notes (user_id, created_at desc);

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  to_email text not null,
  template text not null,
  subject text not null,
  resend_message_id text,
  status text not null default 'sent' check (status in ('sent','failed','queued')),
  error text,
  sent_at timestamptz not null default now()
);
create index if not exists email_log_user_idx on public.email_log (user_id, sent_at desc) where user_id is not null;
create index if not exists email_log_template_idx on public.email_log (template, sent_at desc);

create table if not exists public.unsubscribes (
  email text primary key,
  scope text not null default 'broadcast' check (scope in ('broadcast','all')),
  opted_out_at timestamptz not null default now()
);

-- =====================================================================
-- Auto-create a profile when an auth user is created
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null then
    return new;
  end if;
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any auth user that predates the trigger.
insert into public.profiles (id, email, full_name)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null and u.email is not null;

-- =====================================================================
-- Referrals: "who referred you" + two-sided reward on first payment
-- =====================================================================
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid unique references public.profiles(id) on delete set null,
  code text not null,
  status text not null default 'signed_up' check (status in ('signed_up','qualified','rewarded','expired','voided')),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  referrer_reward_pass_id uuid references public.pass_purchases(id) on delete set null,
  referred_reward_pass_id uuid references public.pass_purchases(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id, created_at desc);
create index if not exists referrals_status_idx on public.referrals (status) where status in ('signed_up','qualified');
drop trigger if exists referrals_updated_at on public.referrals;
create trigger referrals_updated_at before update on public.referrals
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Account credit: TTD store credit (refunds-as-credit, goodwill)
-- =====================================================================
create table if not exists public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  recipient_email text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'TTD',
  reason text not null check (reason in ('closure_compensation','refund_as_credit','goodwill','referral','other')),
  reason_note text,
  expires_at timestamptz not null,
  issued_by uuid references public.profiles(id),
  attached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_grants_target_check check (user_id is not null or recipient_email is not null)
);
create index if not exists credit_grants_user_idx on public.credit_grants (user_id) where user_id is not null;
create index if not exists credit_grants_email_idx on public.credit_grants (lower(recipient_email)) where user_id is null;
create index if not exists credit_grants_expires_idx on public.credit_grants (expires_at);
drop trigger if exists credit_grants_updated_at on public.credit_grants;
create trigger credit_grants_updated_at before update on public.credit_grants
  for each row execute function public.set_updated_at();

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  grant_id uuid references public.credit_grants(id) on delete set null,
  amount_cents integer not null,
  balance_after_cents integer not null check (balance_after_cents >= 0),
  reason text not null,
  payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

create or replace function public.attach_unclaimed_credits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  grant_row public.credit_grants;
  current_balance integer;
begin
  select coalesce(
    (select balance_after_cents from public.credit_ledger
     where user_id = new.id order by created_at desc limit 1), 0)
  into current_balance;
  for grant_row in
    select * from public.credit_grants
    where user_id is null and lower(recipient_email) = lower(new.email) and expires_at > now()
  loop
    update public.credit_grants set user_id = new.id, attached_at = now() where id = grant_row.id;
    current_balance := current_balance + grant_row.amount_cents;
    insert into public.credit_ledger (user_id, grant_id, amount_cents, balance_after_cents, reason)
    values (new.id, grant_row.id, grant_row.amount_cents, current_balance, 'grant attached on signup');
  end loop;
  return new;
end $$;
drop trigger if exists attach_unclaimed_credits_trigger on public.profiles;
create trigger attach_unclaimed_credits_trigger
  after insert on public.profiles
  for each row execute function public.attach_unclaimed_credits();

-- =====================================================================
-- Messages (in-app, two-way) + groups + member requests
-- =====================================================================
create table if not exists public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,   -- null = everyone
  title text not null,
  body text not null,
  sender text not null default 'team' check (sender in ('team','member')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists member_notifications_user_idx on public.member_notifications (user_id, created_at desc);

create table if not exists public.member_notification_reads (
  notification_id uuid not null references public.member_notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

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

-- =====================================================================
-- Discount codes, room-hour credits (legacy, kept for code compat),
-- add-ons, expenses, pool contributions
-- =====================================================================
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
create index if not exists room_hour_credits_user_idx on public.room_hour_credits (user_id, resource_id);

create table if not exists public.member_addons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  amount_cents integer not null check (amount_cents >= 0),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists member_addons_user_idx on public.member_addons (user_id);

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

-- What each coach put toward rent / shared costs in a month, on top of
-- the open-gym and shop revenue that pools automatically.
create table if not exists public.pool_contributions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  month date not null,   -- first day of the month
  note text,
  created_at timestamptz not null default now()
);
create index if not exists pool_contributions_month_idx on public.pool_contributions (month desc, coach_id);

-- =====================================================================
-- Feedback forms, welcome pack, storage buckets
-- =====================================================================
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
create table if not exists public.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.feedback_forms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (form_id, user_id)
);
create table if not exists public.welcome_pack_files (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  storage_path text not null,
  mime_type text,
  size_bytes integer,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public) values
  ('visitor-photos', 'visitor-photos', false),
  ('welcome-pack', 'welcome-pack', false),
  ('coach-photos', 'coach-photos', true)
on conflict (id) do nothing;

-- =====================================================================
-- Applications + waitlist: the front door. No self-serve sign-up.
-- =====================================================================
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  experience_bracket text not null check (experience_bracket in ('under_6m','6_24m','2y_plus')),
  training_now text,
  goal text,
  heard_from text,
  referred_by text,
  code_accepted_at timestamptz,
  status text not null default 'new' check (status in (
    'new','screened_out','intro_booked','waitlisted','invited','approved','declined'
  )),
  coach_notes text,
  intro_booking_id uuid references public.bookings(id) on delete set null,
  invited_at timestamptz,
  invite_expires_at timestamptz,
  invite_payment_id uuid references public.payments(id) on delete set null,
  approved_user_id uuid references public.profiles(id) on delete set null,
  last_nudged_at timestamptz,
  nudge_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_status_idx on public.applications (status, created_at);
create index if not exists applications_email_idx on public.applications (lower(email));
drop trigger if exists applications_updated_at on public.applications;
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Shop: the fridge. Sales land in the pool.
-- =====================================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  variant text not null default '',   -- '' = no variant (unique needs a non-null)
  price_cents integer not null default 0 check (price_cents >= 0),
  stock integer not null default 0,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (name, variant)
);

create table if not exists public.stock_moves (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('restock','sale','adjust')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_moves_product_idx on public.stock_moves (product_id, created_at desc);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  unit_cents integer not null check (unit_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  user_id uuid references public.profiles(id) on delete set null,     -- the member, if known
  payment_id uuid references public.payments(id) on delete set null,
  payment_method text not null check (payment_method in ('wam_online','wam_pos','cash','credit','other')),
  sold_by uuid references public.profiles(id) on delete set null,      -- who was at the desk
  created_at timestamptz not null default now()
);
create index if not exists sales_created_idx on public.sales (created_at desc);
create index if not exists sales_product_idx on public.sales (product_id, created_at desc);

-- Keep products.stock in step with stock_moves.
create or replace function public.apply_stock_move()
returns trigger language plpgsql as $$
begin
  update public.products set stock = stock + new.delta where id = new.product_id;
  return new;
end $$;
drop trigger if exists stock_moves_apply on public.stock_moves;
create trigger stock_moves_apply after insert on public.stock_moves
  for each row execute function public.apply_stock_move();

-- =====================================================================
-- Admin RPCs (bookings need range math PostgREST can't express)
-- =====================================================================
create or replace function public.admin_upcoming_bookings(within_hours int default 2)
returns table (
  id uuid, during text, user_id uuid, resource_id text, status text,
  full_name text, email text, guest_name text, resource_name text
)
language sql security definer set search_path = public as $$
  select b.id, b.during::text, b.user_id, b.resource_id, b.status,
         p.full_name, p.email, b.guest_name, r.name as resource_name
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
returns integer language sql security definer set search_path = public as $$
  select count(*)::int from public.bookings
  where status in ('confirmed','held') and lower(during) >= now();
$$;
revoke all on function public.admin_upcoming_bookings_count() from public;
grant execute on function public.admin_upcoming_bookings_count() to authenticated, service_role;

drop function if exists public.admin_bookings_list(text, text, integer);
create or replace function public.admin_bookings_list(when_filter text, status_filter text default null::text, row_limit integer default 100)
 returns table(id uuid, during text, status text, price_cents integer, user_id uuid, guest_name text, guest_email text, resource_id text, resource_name text, full_name text, email text, notes text, payment_id uuid, paid_at timestamptz, checked_in_at timestamptz, booking_group_id uuid)
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  lo timestamptz;
  hi timestamptz;
  asc_order boolean := true;
  ast_today_start timestamptz := (date_trunc('day', (now() at time zone 'America/Port_of_Spain')) at time zone 'America/Port_of_Spain');
begin
  if when_filter = 'today' then
    lo := ast_today_start; hi := ast_today_start + interval '1 day';
  elsif when_filter = 'week' then
    lo := ast_today_start; hi := ast_today_start + interval '7 days';
  elsif when_filter = 'upcoming' then
    lo := now();
  elsif when_filter = 'past' then
    hi := now(); asc_order := false;
  end if;

  return query
  select b.id, b.during::text, b.status, b.price_cents, b.user_id, b.guest_name, b.guest_email,
         b.resource_id, r.name as resource_name, p.full_name, p.email, b.notes,
         b.payment_id, b.paid_at, b.checked_in_at, b.booking_group_id
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

-- Link a signed-up owner/coach account to a coach slot. Run once per
-- coach after they've created their account:
--   select public.link_coach('nasyir', 'nasyir@example.com', 'Nasyir Rodriguez');
-- Sets role 'owner', creates the coaches row, points the PT resource at
-- it, and seeds availability from opening hours.
create or replace function public.link_coach(coach_slug text, coach_email text, coach_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  wd integer;
begin
  select id into pid from public.profiles where lower(email) = lower(coach_email);
  if pid is null then
    raise exception 'no profile for %', coach_email;
  end if;
  update public.profiles set role = 'owner', designation = 'owner' where id = pid;
  insert into public.coaches (id, display_name, slug, display_order)
  values (pid, coach_display_name, coach_slug,
          case coach_slug when 'nasyir' then 1 when 'matthew' then 2 else 9 end)
  on conflict (id) do update set display_name = excluded.display_name, slug = excluded.slug;
  update public.resources set coach_id = pid where id = 'pt-' || coach_slug;
  if not exists (select 1 from public.coach_availability where coach_id = pid) then
    for wd in 1..5 loop
      insert into public.coach_availability (coach_id, weekday, start_minute, end_minute)
      values (pid, wd, 330, 1140);          -- 05:30–19:00
    end loop;
    insert into public.coach_availability (coach_id, weekday, start_minute, end_minute)
    values (pid, 6, 420, 780);              -- Sat 07:00–13:00
  end if;
  return pid;
end $$;
revoke all on function public.link_coach(text, text, text) from public;
grant execute on function public.link_coach(text, text, text) to service_role;

-- =====================================================================
-- Row Level Security. Members read their own rows; everything the gym
-- does goes through the service role (server actions / route handlers).
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.designation_roles enable row level security;
alter table public.plans enable row level security;
alter table public.passes enable row level security;
alter table public.resources enable row level security;
alter table public.coaches enable row level security;
alter table public.coach_availability enable row level security;
alter table public.coach_blocks enable row level security;
alter table public.subscriptions enable row level security;
alter table public.pass_purchases enable row level security;
alter table public.pass_adjustments enable row level security;
alter table public.payments enable row level security;
alter table public.booking_groups enable row level security;
alter table public.bookings enable row level security;
alter table public.invoices enable row level security;
alter table public.session_ledger enable row level security;
alter table public.settings enable row level security;
alter table public.checkin_devices enable row level security;
alter table public.visits enable row level security;
alter table public.reception_status enable row level security;
alter table public.admin_notes enable row level security;
alter table public.email_log enable row level security;
alter table public.unsubscribes enable row level security;
alter table public.referrals enable row level security;
alter table public.credit_grants enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.member_notifications enable row level security;
alter table public.member_notification_reads enable row level security;
alter table public.message_groups enable row level security;
alter table public.message_group_members enable row level security;
alter table public.member_requests enable row level security;
alter table public.discount_codes enable row level security;
alter table public.room_hour_credits enable row level security;
alter table public.member_addons enable row level security;
alter table public.expenses enable row level security;
alter table public.pool_contributions enable row level security;
alter table public.feedback_forms enable row level security;
alter table public.feedback_responses enable row level security;
alter table public.welcome_pack_files enable row level security;
alter table public.applications enable row level security;
alter table public.products enable row level security;
alter table public.stock_moves enable row level security;
alter table public.sales enable row level security;

-- Public catalog
drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans for select using (is_active = true);
drop policy if exists passes_public_read on public.passes;
create policy passes_public_read on public.passes for select using (is_active = true);
drop policy if exists resources_public_read on public.resources;
create policy resources_public_read on public.resources for select using (true);
drop policy if exists coaches_public_read on public.coaches;
create policy coaches_public_read on public.coaches for select using (is_active = true);
drop policy if exists coach_availability_public_read on public.coach_availability;
create policy coach_availability_public_read on public.coach_availability for select using (true);
drop policy if exists coach_blocks_auth_read on public.coach_blocks;
create policy coach_blocks_auth_read on public.coach_blocks for select using (auth.role() = 'authenticated');
drop policy if exists designation_roles_public_read on public.designation_roles;
create policy designation_roles_public_read on public.designation_roles for select using (true);
drop policy if exists settings_public_read on public.settings;
create policy settings_public_read on public.settings for select using (true);
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (is_active = true);
drop policy if exists reception_status_public_read on public.reception_status;
create policy reception_status_public_read on public.reception_status for select using (true);

-- Profiles
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select using (auth.uid() = id or is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (auth.uid() = id or is_admin());
drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles for insert with check (is_admin());

-- Member-owned rows: read own, gym writes (via is_admin() or service role)
drop policy if exists subscriptions_user_read on public.subscriptions;
create policy subscriptions_user_read on public.subscriptions for select using (auth.uid() = user_id or is_admin());
drop policy if exists subscriptions_admin_write on public.subscriptions;
create policy subscriptions_admin_write on public.subscriptions for all using (is_admin()) with check (is_admin());

drop policy if exists pass_purchases_user_read on public.pass_purchases;
create policy pass_purchases_user_read on public.pass_purchases for select using (auth.uid() = user_id or is_admin());
drop policy if exists pass_purchases_admin_write on public.pass_purchases;
create policy pass_purchases_admin_write on public.pass_purchases for all using (is_admin()) with check (is_admin());

drop policy if exists pass_adjustments_admin_read on public.pass_adjustments;
create policy pass_adjustments_admin_read on public.pass_adjustments for select using (is_admin());
drop policy if exists pass_adjustments_admin_write on public.pass_adjustments;
create policy pass_adjustments_admin_write on public.pass_adjustments for all using (is_admin()) with check (is_admin());

drop policy if exists bookings_user_read on public.bookings;
create policy bookings_user_read on public.bookings for select using (auth.uid() = user_id or is_admin());
drop policy if exists bookings_admin_write on public.bookings;
create policy bookings_admin_write on public.bookings for all using (is_admin()) with check (is_admin());

drop policy if exists booking_groups_user_read on public.booking_groups;
create policy booking_groups_user_read on public.booking_groups for select using (auth.uid() = user_id or is_admin());
drop policy if exists booking_groups_admin_write on public.booking_groups;
create policy booking_groups_admin_write on public.booking_groups for all using (is_admin()) with check (is_admin());

drop policy if exists payments_user_read on public.payments;
create policy payments_user_read on public.payments for select using (auth.uid() = user_id or is_admin());
drop policy if exists payments_admin_write on public.payments;
create policy payments_admin_write on public.payments for all using (is_admin()) with check (is_admin());

drop policy if exists invoices_user_read on public.invoices;
create policy invoices_user_read on public.invoices for select using (auth.uid() = user_id or is_admin());
drop policy if exists invoices_admin_write on public.invoices;
create policy invoices_admin_write on public.invoices for all using (is_admin()) with check (is_admin());

drop policy if exists session_ledger_user_read on public.session_ledger;
create policy session_ledger_user_read on public.session_ledger for select using (auth.uid() = user_id or is_admin());
drop policy if exists session_ledger_admin_write on public.session_ledger;
create policy session_ledger_admin_write on public.session_ledger for all using (is_admin()) with check (is_admin());

drop policy if exists checkin_devices_admin_all on public.checkin_devices;
create policy checkin_devices_admin_all on public.checkin_devices for all using (is_admin()) with check (is_admin());

drop policy if exists visits_user_read_own on public.visits;
create policy visits_user_read_own on public.visits for select using (auth.uid() = user_id or auth.uid() = host_user_id or is_admin());
drop policy if exists visits_admin_write on public.visits;
create policy visits_admin_write on public.visits for all using (is_admin()) with check (is_admin());

drop policy if exists reception_status_admin_write on public.reception_status;
create policy reception_status_admin_write on public.reception_status for all using (is_admin()) with check (is_admin());

drop policy if exists admin_notes_admin_all on public.admin_notes;
create policy admin_notes_admin_all on public.admin_notes for all using (is_admin()) with check (is_admin());

drop policy if exists email_log_user_read on public.email_log;
create policy email_log_user_read on public.email_log for select using (auth.uid() = user_id or is_admin());
drop policy if exists email_log_admin_write on public.email_log;
create policy email_log_admin_write on public.email_log for all using (is_admin()) with check (is_admin());

drop policy if exists referrals_user_read on public.referrals;
create policy referrals_user_read on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referred_user_id or is_admin());
drop policy if exists referrals_admin_write on public.referrals;
create policy referrals_admin_write on public.referrals for all using (is_admin()) with check (is_admin());

drop policy if exists credit_grants_user_read on public.credit_grants;
create policy credit_grants_user_read on public.credit_grants for select using (auth.uid() = user_id or is_admin());
drop policy if exists credit_grants_admin_write on public.credit_grants;
create policy credit_grants_admin_write on public.credit_grants for all using (is_admin()) with check (is_admin());
drop policy if exists credit_ledger_user_read on public.credit_ledger;
create policy credit_ledger_user_read on public.credit_ledger for select using (auth.uid() = user_id or is_admin());
drop policy if exists credit_ledger_admin_write on public.credit_ledger;
create policy credit_ledger_admin_write on public.credit_ledger for all using (is_admin()) with check (is_admin());

drop policy if exists "members read own or broadcast notifications" on public.member_notifications;
create policy "members read own or broadcast notifications"
  on public.member_notifications for select using (user_id = auth.uid() or user_id is null);
drop policy if exists "members send messages to the team" on public.member_notifications;
create policy "members send messages to the team"
  on public.member_notifications for insert with check (user_id = auth.uid() and sender = 'member');
drop policy if exists "members read own notification reads" on public.member_notification_reads;
create policy "members read own notification reads"
  on public.member_notification_reads for select using (user_id = auth.uid());
drop policy if exists "members mark own notifications read" on public.member_notification_reads;
create policy "members mark own notifications read"
  on public.member_notification_reads for insert with check (user_id = auth.uid());

drop policy if exists "members read own requests" on public.member_requests;
create policy "members read own requests" on public.member_requests for select using (user_id = auth.uid());
drop policy if exists "members read own room hour credits" on public.room_hour_credits;
create policy "members read own room hour credits" on public.room_hour_credits for select using (user_id = auth.uid());
drop policy if exists "members read own addons" on public.member_addons;
create policy "members read own addons" on public.member_addons for select using (user_id = auth.uid());
drop policy if exists "members read open forms" on public.feedback_forms;
create policy "members read open forms" on public.feedback_forms for select using (is_open = true);

-- Coaches see their own pool contributions; owners see all (service role).
drop policy if exists pool_contributions_coach_read on public.pool_contributions;
create policy pool_contributions_coach_read on public.pool_contributions for select using (auth.uid() = coach_id or is_admin());

-- Members can see what they bought at the fridge.
drop policy if exists sales_user_read on public.sales;
create policy sales_user_read on public.sales for select using (auth.uid() = user_id or is_admin());

-- Tables with no member policies (service role only): settings writes,
-- discount_codes, message_groups(+members), expenses, feedback_responses,
-- welcome_pack_files, applications, stock_moves, unsubscribes.

-- =====================================================================
-- Realtime: the admin overview and the kiosk banner subscribe to these.
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'visits') then
    alter publication supabase_realtime add table public.visits;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'reception_status') then
    alter publication supabase_realtime add table public.reception_status;
  end if;
end$$;
alter table public.visits replica identity full;
alter table public.reception_status replica identity full;
