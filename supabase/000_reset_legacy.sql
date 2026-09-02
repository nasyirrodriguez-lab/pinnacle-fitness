-- Reset the ORIGINAL pinnacle-fitness app's tables before applying
-- migrations/000_pinnacle.sql. The owners decided existing members re-sign
-- as new, so nothing here is migrated. Auth users are left alone (they can
-- keep their login); their old profile rows go.
--
-- Run once, as the service role / SQL editor. Irreversible.

drop table if exists public.free_trial_bookings cascade;
drop table if exists public.bookings cascade;      -- old shape (class_id/member_id); recreated by the new schema
drop table if exists public.classes cascade;
drop table if exists public.check_ins cascade;
drop table if exists public.payments cascade;      -- old shape (numeric amount, stripe columns); recreated
drop table if exists public.coaches cascade;       -- old marketing table; recreated as the real coaches table
drop table if exists public.plans cascade;         -- old shape (slug/price integer); recreated
drop table if exists public.members cascade;
-- Found live on the real project but absent from the old schema file:
drop table if exists public.checkins cascade;
drop table if exists public.memberships cascade;
drop table if exists public.profiles cascade;      -- old shape (no email/archived); recreated
drop function if exists public.handle_new_user() cascade;

-- Old policies referenced members; they die with the table. Nothing else
-- from the original app lives in public.
