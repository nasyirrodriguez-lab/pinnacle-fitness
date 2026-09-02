-- Pinnacle Fitness — launch data. Idempotent (on conflict do nothing).
-- Run AFTER migrations/000_pinnacle.sql. Prices are TTD cents.
--
-- Coaches are not seeded here: they are real accounts. After Nasyir and
-- Matthew sign in once, run (service role):
--   select public.link_coach('nasyir',  '<nasyir email>',  'Nasyir Rodriguez');
--   select public.link_coach('matthew', '<matthew email>', 'Matthew Sirjoo');

-- =====================================================================
-- Resources: two PT slots (one per coach) + the open-gym floor
-- =====================================================================
insert into public.resources (id, name, description, kind, capacity, price_per_hour_cents, open_hour, close_hour, slot_minutes, is_bookable, display_order)
values
  ('pt-nasyir',  'PT with Nasyir',  'A coached 60-minute small-group session with Nasyir.',  'pt', 6, 12000, 5, 19, 60, true, 1),
  ('pt-matthew', 'PT with Matthew', 'A coached 60-minute small-group session with Matthew.', 'pt', 6, 12000, 5, 19, 60, true, 2),
  ('open-gym',   'Open gym',        'Use the floor during opening hours. No slot — scan in at the door; admitted while there is room.', 'open_gym', 20, null, 5, 19, 60, false, 3)
on conflict (id) do nothing;

-- =====================================================================
-- Monthly plans
-- =====================================================================
insert into public.plans (id, name, description, price_cents, billing_period, features, includes_pt, pt_sessions_per_month, includes_open_gym, is_private, display_order)
values
  ('pt-8', '8 Sessions',
   'Eight coached small-group sessions a month with Nasyir or Matthew. Enough structure to stop guessing and start progressing — for people who already train and want a coach who knows their name.',
   70000, 'month',
   '["8 coached sessions a month","Book either coach","Sessions reset monthly","Open gym available as an add-on"]'::jsonb,
   true, 8, false, false, 10),
  ('pt-12', '12 Sessions',
   'Three coached sessions a week. This is where most people see their biggest shift — you stop waiting to feel motivated and just show up, because your coach and the group expect you to. Includes open gym.',
   90000, 'month',
   '["12 coached sessions a month","Book either coach","Open gym included","Sessions reset monthly"]'::jsonb,
   true, 12, true, false, 20),
  ('unlimited', 'Unlimited',
   'For the fully committed. Unlimited coached sessions, open gym whenever there is room, and priority booking. Not a first gym — a gym that matches your energy every day.',
   100000, 'month',
   '["Unlimited coached sessions","Open gym included","Priority booking","Book either coach"]'::jsonb,
   true, null, true, false, 30),
  ('open-gym-unlimited', 'Open Gym Unlimited',
   'For the self-directed member who already has a program. The floor, the turf and the racks whenever the gym is open and there is room. No coaching included.',
   45000, 'month',
   '["Unlimited open gym","Scan in at the door","No coached sessions"]'::jsonb,
   false, 0, true, false, 40),
  ('open-gym-addon', 'Open Gym add-on',
   'Adds open gym to the 8 Sessions plan. Applied by the team.',
   15000, 'month',
   '["Open gym included with your 8 Sessions plan"]'::jsonb,
   false, 0, true, true, 50)
on conflict (id) do nothing;

-- =====================================================================
-- Packs (30-day expiry — packs expire monthly)
-- =====================================================================
insert into public.passes (id, name, description, price_cents, session_kind, uses_total, validity_days, features, display_order)
values
  ('pt-single', '1 PT session',
   'One coached small-group session. For a member between plans.',
   12000, 'pt', 1, 30, '["1 coached session","Use within 30 days"]'::jsonb, 10),
  ('pt-5', '5 PT sessions',
   'Five coached small-group sessions to use within 30 days. Flexibility without a monthly commitment.',
   55000, 'pt', 5, 30, '["5 coached sessions","Book either coach","Use within 30 days"]'::jsonb, 20),
  ('pt-10', '10 PT sessions',
   'Ten coached sessions in 30 days — two or three a week, your way.',
   100000, 'pt', 10, 30, '["10 coached sessions","Book either coach","Use within 30 days"]'::jsonb, 30),
  ('pt-20', '20 PT sessions',
   'The serious pack. Twenty coached sessions in 30 days for people who train most days.',
   180000, 'pt', 20, 30, '["20 coached sessions","Book either coach","Use within 30 days"]'::jsonb, 40),
  ('og-single', 'Open gym visit',
   'One visit to the floor. Scan in at the door; admitted while there is room.',
   7500, 'open_gym', 1, 30, '["1 open gym visit","Use within 30 days"]'::jsonb, 50),
  ('og-5', '5 open gym visits',
   'Five visits within 30 days.',
   32500, 'open_gym', 5, 30, '["5 open gym visits","Use within 30 days"]'::jsonb, 60),
  ('og-10', '10 open gym visits',
   'Ten visits within 30 days.',
   60000, 'open_gym', 10, 30, '["10 open gym visits","Use within 30 days"]'::jsonb, 70),
  ('og-20', '20 open gym visits',
   'Twenty visits within 30 days — near-daily floor access without the monthly plan.',
   100000, 'open_gym', 20, 30, '["20 open gym visits","Use within 30 days"]'::jsonb, 80)
on conflict (id) do nothing;

-- =====================================================================
-- The fridge. price_cents = 0 until the owners set prices in Admin → Shop.
-- =====================================================================
insert into public.products (name, variant, price_cents, display_order) values
  ('Water', '', 0, 1),
  ('Lucozade', '', 0, 2),
  ('Gatorade', '', 0, 3),
  ('Lean Body protein shake', 'Vanilla', 0, 4),
  ('Lean Body protein shake', 'Chocolate', 0, 5),
  ('Ghost pre-workout', 'Iced Tea Lemonade', 0, 6),
  ('Ghost pre-workout', 'Blue Raspberry', 0, 7),
  ('Bloom pre-workout', 'Strawberry Watermelon', 0, 8),
  ('Bloom pre-workout', 'Crisp Apple', 0, 9)
on conflict (name, variant) do nothing;
