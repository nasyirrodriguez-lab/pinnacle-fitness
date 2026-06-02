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
  created_at  timestamptz default now()
);

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
