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

When a booking changes from `pending` (or another non-confirmed state) to `confirmed`:

1. The same function syncs the sheet.
2. It sends a branded booking confirmation / receipt through the Gmail API.
3. The email includes the Malaya Campsite logo inline when `MALAYA_LOGO_URL` is reachable.
4. `receipt_sent_at` is recorded in Supabase to prevent duplicate automatic receipts.

Google's Gmail API uses OAuth 2.0 and the `users.messages.send` endpoint; messages are sent as base64url-encoded MIME in the `raw` field. Google Sheets uses `spreadsheets.values.append` for new rows and `spreadsheets.values.update` for row synchronization.

### Required Google OAuth scopes

The refresh token used by the Edge Function needs, at minimum:

- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/spreadsheets`

Use an OAuth 2.0 authorization-code flow with offline access so the backend can refresh access tokens without the Gmail account being present. Google documents refresh tokens as the mechanism for offline API access. Do not commit the client secret or refresh token to Git.

Important: if the Google OAuth consent screen is still in **Testing** for an external app, Google currently limits authorization to listed test users and the authorization/refresh token expires after seven days. Put the production OAuth app into the appropriate production state before relying on it continuously.

### Supabase Edge Function secrets

Set these in **Supabase -> Edge Functions -> Secrets** (not in the Vite frontend):

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_SHEET_ID=...
GOOGLE_SHEET_RANGE=Bookings!A:O
GMAIL_SENDER_EMAIL=malayacampsite@gmail.com
MALAYA_PUBLIC_SITE_URL=https://your-domain.com
MALAYA_LOGO_URL=https://your-domain.com/images/logo.png
```

Supabase already supplies the project URL and secret/publishable keys to Edge Functions; the service key is used only inside the Edge Function for trusted database updates.

### Configure the Database Webhook

After deploying the Edge Function, in Supabase Dashboard -> Database -> Webhooks create a webhook for:

- Table: `public.bookings`
- Events: `INSERT` and `UPDATE`
- Destination: the `booking-automation` Supabase Edge Function
- Method: `POST`
- Authorization header: add the Supabase service key through the Dashboard option
- Content-Type: `application/json`

The function has `verify_jwt = false` because it authenticates this server-to-server webhook itself by comparing the bearer token with the configured Supabase secret/service key.

### Deploy the function

With the Supabase CLI linked to the correct project:

```bash
supabase functions deploy booking-automation
```

Then set production secrets with either the Supabase Dashboard or:

```bash
supabase secrets set --env-file supabase/functions/.env
```

Do not commit `supabase/functions/.env`.

## Spreadsheet columns

The automation uses the following order in the `Bookings` tab:

1. Booking ID
2. Booking Reference
3. Stay
4. Check-in
5. Check-out
6. Guests
7. Full Name
8. Email
9. Phone
10. Preferred Arrival
11. Notes
12. Status
13. Created At
14. Updated At
15. Receipt Sent At

The function automatically creates the header row if the configured sheet is empty.

Spreadsheet formula injection is explicitly mitigated: booking text that begins with `=`, `+`, `-`, or `@` is written as a literal text value instead of being interpreted as a formula.

## Review QR flow

The QR code should point to:

```text
https://YOUR-DOMAIN/review
```

The route is intentionally not included in the normal navigation. It is a standalone mobile-friendly form for guests after their stay.

Flow:

Guest scans QR -> review page -> full name -> stars -> review text -> submit -> confirmation -> `/` `#reviews`.

Reviews are immediately published by default so the guest story can appear on the public homepage. Staff can later hide or delete a review from `/admin` without exposing any account system to the guest.

## Security notes

- Never put Google OAuth client secrets or refresh tokens in a Vite environment variable.
- Never put a Supabase service-role/secret key in the browser.
- Review text is never injected as HTML.
- Booking/customer data remains protected by Supabase RLS.
- The Edge Function validates the server-to-server webhook bearer token.
- Google Sheets writes protect against spreadsheet formula injection.
- Email HTML escapes all booking-supplied values before rendering them.

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Vercel

Set only the public Supabase values in Vercel:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Google credentials stay in Supabase Edge Function secrets.

`vercel.json` rewrites application routes to `index.html`, so `/admin` and `/review` work on direct navigation and refresh.

## Supplied photography and hero video

The website uses the supplied Malaya Campsite imagery and optimized hero videos in `public/images` and `public/videos`.

Desktop hero video: `public/videos/malaya-hero.mp4`

Mobile hero video: `public/videos/malaya-hero-mobile.mp4`


## Guest review photos

The QR review page at `/review` accepts an optional JPG, PNG, or WebP guest photo without requiring an account.
The browser downsizes the image, converts it to WebP, and stores only the compressed Base64 payload in
`public.site_reviews.photo_data`. The database constraint caps the stored value at 1.8 million Base64 characters.

Apply the updated `supabase-schema.sql` before using the photo field. Existing reviews remain valid because `photo_data`
is nullable.

Review text and guest names are always rendered as text nodes. The app never injects review HTML, and photo data is
accepted only as Base64 for a browser-generated WebP image. The review route remains hidden from normal navigation and
is intended for the printed QR code.
