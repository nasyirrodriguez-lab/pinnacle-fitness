# Pinnacle Fitness — database

Project ref: `wvxfeusbaaxcqyjgziwi` (Supabase). Everything the app needs
lives in `public`; auth is Supabase Auth.

## Files

| File | Purpose |
|---|---|
| `000_reset_legacy.sql` | Drops the original gym app's tables (`members`, `plans`, `coaches`, `classes`, `bookings`, `payments`, `check_ins`, `free_trial_bookings`). Run ONCE on the existing project, before the schema. |
| `migrations/000_pinnacle.sql` | The whole schema. Idempotent — safe to re-run after every change. |
| `seed.sql` | Launch catalog: resources, plans, packs, products, settings live in the migration. Idempotent. |

## Applying

**Management API (what Claude Code uses once a personal access token is available):**

```bash
TOKEN=sbp_...   # supabase.com/dashboard/account/tokens
REF=wvxfeusbaaxcqyjgziwi
for f in supabase/000_reset_legacy.sql supabase/migrations/000_pinnacle.sql supabase/seed.sql; do
  jq -Rs '{query: .}' "$f" | curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @-
done
```

**SQL editor:** paste the three files in that order.

**Coaches:** after Nasyir and Matthew have signed in once (magic link or
password), link their accounts to their PT slots:

```sql
select public.link_coach('nasyir',  'nasyir@…',  'Nasyir Rodriguez');
select public.link_coach('matthew', 'matthew@…', 'Matthew Sirjoo');
```

That sets their role to `owner`, creates the `coaches` row, points
`resources.pt-nasyir` / `pt-matthew` at them, and seeds availability
from opening hours (Mon–Fri 05:30–19:00, Sat 07:00–13:00). Front-desk
staff: `update public.profiles set role = 'staff', designation = 'staff' where email = '…'`.

## Tables

| Table | One line |
|---|---|
| `profiles` | One per auth user. `role` member / coach / owner / staff (admin = legacy alias). Gym extras: `pin_code`, `goal`, `training_notes`, `preferred_coach_id`, `experience_bracket`, `applied_at`, `approved_at`, `approved_by`. |
| `designation_roles` | Labels for the kiosk staff list: coach, staff, owner. |
| `coaches` | Public bits + `group_cap` per coach; PK = profile id; `slug` nasyir / matthew. |
| `coach_availability` | Weekly template in minutes-since-midnight (`weekday`, `start_minute`, `end_minute`). |
| `coach_blocks` | One-off unavailability (`starts_at`, `ends_at`, `reason`). |
| `plans` | Monthly memberships. `pt_sessions_per_month` (null = unlimited PT, 0 = no PT), `includes_open_gym`. |
| `passes` | Session packs. `session_kind` pt / open_gym, `uses_total`, `validity_days` 30. |
| `resources` | What gets booked: `pt-nasyir`, `pt-matthew` (kind pt, capacity = group cap), `open-gym` (kind open_gym, capacity = floor cap, never slot-booked). |
| `subscriptions` | Live plan per member; hard monthly reset. |
| `pass_purchases` / `pass_adjustments` | Packs bought + audit of changes. |
| `session_ledger` | Source of truth for sessions left: +grants / −uses with `expires_at` on pack grants. `session_balance(uid, kind)`. |
| `bookings` / `booking_groups` | PT slot bookings (`during` tstzrange). Capacity enforced by trigger `bookings_enforce_capacity`, no exclusion constraint. |
| `payments` | Every Wam / cash / credit transaction. `payment_method` includes cash and credit. |
| `invoices` | Numbered `PIN-YYYY-0001` documents backed by a pending payment. |
| `visits` | The door: every scan in / out. `kind` member / guest / tour / pt / open_gym; `floor_count()` = open visits. |
| `checkin_devices` / `reception_status` | Paired iPads; "Be Right Back" banner singleton. |
| `settings` | `floor_cap` 20, `auto_signout_hours` 3, `pt_cancel_hours` 4, `no_show_minutes` 60, `checkin_early_minutes` 30, `checkin_late_minutes` 30, `lapse_grace_days` 3, `rent_target_cents` 0, `opening_hours`. |
| `applications` | The front door. `plan_interest` (plan id from the form); `status` new → screened_out / intro_booked / waitlisted / invited / approved / declined; invite expiry + payment link; nudge tracking. |
| `products` / `stock_moves` / `sales` | The fridge. Sales stamp `sold_by`; stock kept in step by trigger. |
| `expenses` / `pool_contributions` | Finance tracker + what each coach put toward rent. |
| `credit_grants` / `credit_ledger` | TTD account credit. |
| `discount_codes` | Percent-off codes, usage counted from payment metadata. |
| `member_notifications` / `member_notification_reads` / `message_groups` / `message_group_members` | In-app messages, two-way, plus named groups. |
| `member_requests` | Pause / deactivate / reactivate requests. |
| `referrals` | "Who referred you" + rewards. |
| `admin_notes`, `email_log`, `unsubscribes` | CRM notes, sent-mail log, opt-outs. |
| `feedback_forms` / `feedback_responses`, `welcome_pack_files` | Quarterly feedback, welcome pack uploads. |
| `room_hour_credits`, `member_addons` | Kept from the platform base for code compatibility (add-ons = the open-gym add-on line). |

Buckets: `visitor-photos` (private), `welcome-pack` (private), `coach-photos` (public).

RPCs: `admin_upcoming_bookings`, `admin_upcoming_bookings_count`, `admin_bookings_list`, `session_balance`, `floor_count`, `link_coach`, `next_invoice_number`, `is_admin`, `is_staff_or_above`.
