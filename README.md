# Malaya Campsite - Vite + React + Supabase

A single-page public website for Malaya Campsite in Nasugbu, Batangas, with `/admin` for staff operations and a hidden `/review` route intended for a printed QR code after a guest's stay.

## Stack

- Vite + React + TypeScript
- React Router for `/`, `/admin`, and hidden `/review`
- Supabase Postgres + Row Level Security for bookings, reviews, guest support, and live homepage content
- Supabase Auth for staff access
- Supabase Edge Functions for Gmail API + Google Sheets API automation
- Vercel for the public frontend

## Front-end reference

The supplied mockup PDF was used as the content and visual reference. The site preserves the reference wording where it is provided, including the hero line, booking labels, accommodation labels, inclusions, guest-story heading, location block, FAQ questions, and final call-to-action. The implementation remains a responsive React site rather than a pixel-for-pixel recreation.

Examples from the reference include:

- "You don’t have to keep up with the world today."
- "Traditional province-style camping. A slow living escape."
- "Silipin ang Malaya"
- "From ₱999 for 2 guests"
- "22-hour stay · Nasugbu, Batangas"
- "The Art of Doing Nothing."
- "Kape, walang minamadali."
- "Umupo. Tumingin. Huminga."
- "Matulog buong hapon."
- "Simpleng tuluyan mo."
- "Kasama sa pahinga mo."
- "Mga kwentong Malaya."
- "Malaya is not a resort."
- "Bago bumiyahe."
- "Frequently asked questions."
- "You don’t have to earn your rest."
- "Dito, pwedeng-pwede magpahinga."

## Supabase database

Run the complete `supabase-schema.sql` in the Supabase SQL Editor. It includes:

- booking tables and status constraints
- admin authorization and RLS
- visitor-token customer service RPCs
- homepage message storage
- booking automation metadata
- `site_reviews` for the account-free review flow
- public insert/select policies for published reviews
- admin review moderation (publish/hide/delete)

Public review submissions require only a full name, 1-5 star rating, and review text. No Supabase account is required. The frontend renders review text as React text nodes only; it does not use `dangerouslySetInnerHTML`. Inputs are normalized and length-limited before submission, and the database enforces length/rating constraints.

## Admin panel

Open `/admin`.

Staff can:

- sign in with Supabase Auth
- review and update booking statuses
- see booking automation state (spreadsheet sync + receipt status)
- read customer-service conversations
- reply to guests and close conversations
- publish, hide, or delete guest reviews
- update the homepage daily message

Authorization is enforced by the `admin_users` table plus Supabase RLS.

## Google Sheets + Gmail automation

The main database remains Supabase. Google Sheets is a secondary operational copy for bookings only.

### What happens automatically

When a booking is inserted:

1. Supabase writes the booking to Postgres.
2. A Supabase Database Webhook calls the `booking-automation` Edge Function.
3. The function appends the booking to the configured Google Sheet and stores the resulting sheet row number back in Supabase.

When a booking is edited (including an admin status change):

1. Supabase fires the same webhook on `UPDATE`.
2. The function updates the corresponding sheet row.

When a booking changes from a non-confirmed state to `confirmed`:

1. The same function syncs the sheet.
2. It sends a branded booking confirmation through the Gmail API once Gmail is configured.
3. `receipt_sent_at` is recorded in Supabase to prevent duplicate automatic receipts.

### Current Supabase key approach

This project uses Supabase's current **publishable/secret API key model**.

**Frontend (`.env`)**

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The browser never receives a Supabase secret key.

**CLI (`.env.supabase`)**

```env
SUPABASE_PROJECT_REF=YOUR_PROJECT_REF
SUPABASE_ACCESS_TOKEN=sbp_...
```

`SUPABASE_ACCESS_TOKEN` is the Supabase CLI Personal Access Token used for deployment. It is not the database secret key. This lets you deploy without `supabase login`.

**Edge Function (`supabase/functions/.env`)**

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_SHEET_ID=...
GOOGLE_SHEET_RANGE=Bookings!A:O
GMAIL_SENDER_EMAIL=malayacampsite@gmail.com
MALAYA_PUBLIC_SITE_URL=https://malayacampsite.com
MALAYA_LOGO_URL=https://malayacampsite.com/images/logo.png
```

Hosted Supabase automatically provides `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, and `SUPABASE_SECRET_KEYS` to Edge Functions. The function uses `@supabase/server` with `withSupabase({ auth: 'secret' })`, which validates the secret API key and provides `ctx.supabaseAdmin` for trusted database updates.

Do not add a custom `SUPABASE_SECRET_KEY` to the Edge Function secrets. The `SUPABASE_` namespace is reserved for Supabase's injected variables.

### Google OAuth scopes

The Google refresh token needs:

- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/gmail.send` when Gmail is activated

Use OAuth 2.0 offline access so the backend can refresh access tokens without the user being present. Never commit the client secret or refresh token.

### Configure the Database Webhook

After deploying `booking-automation`, create a Database Webhook for `public.bookings` with:

- Events: `INSERT` and `UPDATE`
- Method: `POST`
- Destination: the `booking-automation` Edge Function
- `Content-Type`: `application/json`
- **`apikey` header:** your Supabase **secret API key** (`sb_secret_...`)

Do **not** send the secret key as `Authorization: Bearer ...`. The current Supabase API-key model uses the `apikey` header for secret/publishable keys, and `withSupabase({ auth: 'secret' })` validates it.

For database-side webhook definitions created with SQL/`pg_net`, Supabase recommends keeping the secret in Vault rather than hardcoding it in SQL.

### Deploy without `supabase login`

From PowerShell:

```powershell
cd C:\Users\Administrator\Desktop\Malaya-Campsite
.\scripts\deploy-booking-automation.ps1
```

The script reads `.env.supabase`, pushes the Edge Function secrets from `supabase/functions/.env`, and deploys `booking-automation` to the project ref in `.env.supabase`.

Manual commands:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_YOUR_TOKEN"

npx supabase secrets set --env-file .\supabase\functions\.env --project-ref YOUR_PROJECT_REF

npx supabase functions deploy booking-automation --project-ref YOUR_PROJECT_REF --use-api
```

### Security

Never put any of these in the Vite frontend or commit them:

- `sb_secret_...` Supabase secret keys
- `sbp_...` Supabase CLI access tokens
- Google client secrets
- Google refresh tokens

The only Supabase credential intended for browser use is the publishable key, with access controlled by RLS.

Gmail automation can remain unconfigured while we finish the Supabase + Google Sheets setup.
