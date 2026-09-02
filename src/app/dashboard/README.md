# Member Dashboard

Custom member portal for The Worx, replacing the default Nexudus dashboard.
Built on Next.js 16 App Router with the [Nexudus Members Portal API][nx-api]
and [Wam Payments SDK][wam].

[nx-api]: https://learn.nexudus.com/rest-api/overview
[wam]: https://docs.wam.money

## Architecture

```
Browser
   │  same-origin /api/* and /dashboard/*  (Nexudus token never reaches the browser)
   ▼
Next.js (Node runtime)
   ├─→ src/lib/nexudus/*         typed REST client for Nexudus
   ├─→ src/lib/wam/*             Wam SDK wrapper
   └─→ src/lib/session.ts        encrypted HttpOnly cookie session
```

- **Auth**: magic link via Resend → our HS256 JWT → Nexudus member token. Stored
  encrypted (AES-GCM, key derived from `SESSION_SECRET`) in an HttpOnly cookie.
  See `src/lib/session.ts` and `src/app/sign-in/`.
- **Routing guard**: `src/proxy.ts` checks cookie presence on `/dashboard/*` and
  `/welcome`. Token _validity_ is enforced server-side in every page via
  `getValidAccessToken()`, which auto-refreshes when within 5 min of expiry.
- **Data fetching**: every dashboard page is a Server Component that calls
  `getValidAccessToken()` → typed Nexudus helpers. `getMe` is wrapped in
  `React.cache()` so layout + page share one call per request.
- **Mutations**: server actions for plan pause/resume; route handlers for
  payment checkout/webhook and PDF streaming.

## File map

| Path                                                                           | Purpose                                              |
| ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `src/lib/nexudus/client.ts`                                                    | Typed `fetch` wrapper, `NexudusError`                |
| `src/lib/nexudus/types.ts`                                                     | Zod schemas for Customer/Invoice/Booking/Contract    |
| `src/lib/nexudus/{auth,customer,invoices,contracts,bookings,announcements}.ts` | Resource modules                                     |
| `src/lib/nexudus/admin.ts`                                                     | **Open**: issue member token from email              |
| `src/lib/nexudus/payments.ts`                                                  | **Open**: record external payment against invoice    |
| `src/lib/nexudus/helpers.ts`                                                   | `pickPrimaryContractId`, `formatMoney`, `formatDate` |
| `src/lib/wam/client.ts`                                                        | Wam SDK singleton + webhook secret accessor          |
| `src/lib/session.ts`                                                           | Cookie session, AES-GCM encryption, auto-refresh     |
| `src/lib/jwt.ts`                                                               | HS256 sign/verify for our magic-link tokens          |
| `src/proxy.ts`                                                                 | Cookie-presence guard for protected routes           |
| `src/app/sign-in/page.tsx`                                                     | Magic-link request form                              |
| `src/app/sign-in/callback/page.tsx`                                            | JWT verify → Nexudus exchange → cookie               |
| `src/app/api/auth/{request-link,sign-out}/`                                    | Auth route handlers                                  |
| `src/app/welcome/page.tsx`                                                     | First-time onboarding stepper                        |
| `src/app/dashboard/layout.tsx`                                                 | Sidebar nav + member greeting                        |
| `src/app/dashboard/page.tsx`                                                   | Tiles: plan, invoices, bookings                      |
| `src/app/dashboard/invoices/`                                                  | List + detail + PDF link                             |
| `src/app/api/invoices/[id]/pdf/route.ts`                                       | Streams PDF using member's media JWT                 |
| `src/app/dashboard/plan/`                                                      | Pause/resume via server actions                      |
| `src/app/dashboard/bookings/page.tsx`                                          | Defensive list with fallback UI                      |
| `src/app/dashboard/settings/page.tsx`                                          | Read-only profile                                    |
| `src/app/api/payments/checkout/route.ts`                                       | Creates Wam payment intent                           |
| `src/app/api/payments/wam-webhook/route.ts`                                    | Verifies signature + records payment                 |
| `src/app/api/payments/status/route.ts`                                         | Wam intent status polling                            |
| `src/app/api/_debug/me/route.ts`                                               | Dev-only smoke test (404 in prod)                    |

## Three open Nexudus integration points

Each is isolated to a single function with a clear log message and a fallback
that fails safe. Once Nexudus support confirms the right call, each is a
~5-line swap.

### 1. Issue a member token from an email

**File**: `src/lib/nexudus/admin.ts` → `issueMemberTokenForEmail`
**Currently**: dev-only password grant against `NEXUDUS_DEV_EMAIL`. Production
throws.
**Ask Nexudus support**:

> "Once we've verified the user owns an email address (via our own magic link),
> what's the recommended way for our backend to obtain a member-scoped bearer
> token for that email? Is there an admin REST API endpoint that mints a JWT
> we can then exchange via `POST /api/sys/users/exchange`? Or should we
> trigger Nexudus to email the magic link directly?"

### 2. Record an external (Wam) payment against an invoice

**File**: `src/lib/nexudus/payments.ts` → `recordExternalPaymentForInvoice`
**Currently**: logs and returns `{ recorded: false }`. The webhook still
acks 200, so Wam doesn't retry; The Worx team reconciles manually for now.
**Ask Nexudus support**:

> "When a member pays an invoice through an external payment processor (Wam),
> what's the API call to mark that Nexudus invoice as paid and record the
> external transaction ID? Is there an admin endpoint like
> `POST /api/billing/invoices/{id}/recordPayment`?"

### 3. List a member's bookings

**File**: `src/lib/nexudus/bookings.ts` → `listMyBookings`
**Currently**: tries `/api/public/bookings/my` then `/api/public/bookings`,
accepts either an array or paginated response. Renders a "not available yet"
empty state if both fail. Public docs only describe `GET /api/public/bookings/{id}`.
**Confirm with Nexudus or via network inspection**:

> "Is there a Members Portal API endpoint that lists the authenticated
> member's bookings (with optional date filtering)? If so, what's the path
> and response shape?"

The same trip should also confirm the **create** and **cancel** booking
endpoints — those aren't yet wired (the dashboard surfaces booking list +
status only).

## Environment

```
# Required
NEXUDUS_BASE_URL=https://spaces.nexudus.com   # or your tenant subdomain
SESSION_SECRET=                                # `openssl rand -base64 48`
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Required for magic-link emails (optional in dev — link logs to console)
RESEND_API_KEY=

# Required for Wam payments
WAM_BUSINESS_ID=
WAM_API_KEY=
WAM_ENVIRONMENT=staging
WAM_WEBHOOK_SECRET=

# Dev-only smoke test + dev-mode magic-link
NEXUDUS_DEV_EMAIL=
NEXUDUS_DEV_PASSWORD=
```

## Local testing flow

1. `npm install`, populate `.env.local`.
2. `npm run dev`.
3. **Smoke-test the Nexudus client**: `GET http://localhost:3000/api/_debug/me`
   should return `{ ok: true, me: {...} }`. If it doesn't, fix that before
   moving on.
4. **Auth flow**: visit `/sign-in`, enter `NEXUDUS_DEV_EMAIL`. Without
   `RESEND_API_KEY` the magic link prints to the dev server console — paste
   it in your browser. With `RESEND_API_KEY`, check the inbox.
5. **First sign-in** lands on `/welcome` (3-step stepper). Subsequent
   sign-ins go straight to `/dashboard`.
6. **Wam payments**: open an unpaid invoice, click "Pay with Wam". For
   webhook testing, point Wam staging at an `ngrok` tunnel hitting
   `/api/payments/wam-webhook`, or use the SDK's `MockWamPaymentSDK` from
   `@zed-io/wam-payment-sdk/testing`.

## What's NOT yet implemented

| Feature                 | Blocker                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| Editable profile form   | Nexudus's no-PATCH constraint + unclear which fields are member-writable |
| Booking create / cancel | Endpoints not in public docs                                             |
| Native check-in flow    | Endpoint not in public docs                                              |
| Events list / RSVP      | Endpoint not in public docs                                              |
| Multi-language support  | Out of scope for v1                                                      |

## Conventions

- All UI uses the Worx design system (turquoise primary, Sen/Unbounded fonts,
  shadcn components from `src/components/ui`).
- Nexudus types are defined as Zod schemas with `.passthrough()` so unknown
  tenant-specific fields don't break parsing.
- Dates: `formatDate` from `helpers.ts`. Money: `formatMoney`.
- Errors from Nexudus surface as `NexudusError` (status + message + body).
- Server-side route handlers and Server Components both use
  `getValidAccessToken()`. Never read the cookie directly outside `lib/session.ts`.
