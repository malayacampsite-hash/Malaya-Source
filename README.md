# Malaya Campsite — Vite + React + Supabase

A single-page public website for Malaya Campsite in Nasugbu, Batangas, with a separate `/admin` staff workspace. The public experience is intentionally one page; booking and support open as focused overlays so the guest journey does not become a multi-page maze.

## Stack

- Vite + React + TypeScript
- React Router for `/` and `/admin`
- Supabase Postgres for bookings, support messages, and homepage content
- Supabase Auth for staff sign-in
- Supabase Row Level Security (RLS)
- Vercel deployment

## Design direction

The visual treatment is deliberately restrained and editorial rather than a generic template: strong serif display type, natural paper tones, deep forest green, real campsite photography, thin rules, asymmetric spacing, and image-led sections.

## Guest experience

- One-page homepage with Stay, Experience, Gallery, Booking, and Contact sections
- Real Malaya Campsite photography supplied in the project
- Kanlungan Cabin presentation based on currently accessible public listing details
- Three-step booking request flow
- Booking requests written directly to Supabase
- Guest support widget with assistant-first flow
- Staff handoff from the assistant
- Visitor name, email, and phone capture for staff support
- Conversation history stored in Supabase
- Staff replies appear back in the visitor conversation by polling

## Staff workspace

Open `/admin`.

- Supabase Auth sign-in
- Admin authorization through `admin_users`
- Booking summary metrics
- Searchable and filterable booking requests
- Booking status management: pending, confirmed, declined, completed
- Guest contact and notes visible to staff
- Customer service inbox
- Full recorded conversation thread
- Staff reply and close-conversation controls
- Homepage message editor without redeploying the public site

## Supabase setup

1. Create or use the Malaya Campsite Supabase project.
2. Open **SQL Editor**.
3. Run the complete `supabase-schema.sql` file.
4. In **Authentication → Users**, create the staff/admin user.
5. Add that user's UUID to `admin_users`:

```sql
insert into public.admin_users(user_id)
values ('YOUR-SUPABASE-AUTH-USER-UUID');
```

The schema intentionally prevents anonymous users from creating a booking with `confirmed` or any other operational status: public inserts are limited to `pending`. Confirming a booking is an authenticated admin action. It also adds a PostgreSQL exclusion constraint so two confirmed bookings cannot overlap for the same accommodation.

## Environment variables

Create `.env.local` from `.env.example`:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Set the same variables in **Vercel → Project Settings → Environment Variables**.

Never put a Supabase service-role key into this Vite frontend.

## Run locally

```bash
npm install
npm run dev
```

For production:

```bash
npm run build
npm run preview
```

## Routing / Vercel

`react-router-dom` handles the application routes. `vercel.json` rewrites application requests to `index.html`, which keeps `/admin` working after direct navigation or refresh.

## Supplied photography

The image archive uploaded with the project contained the Malaya Campsite logo plus five campsite photographs. They were optimized to WebP for the website so the original 6,000px camera files are not shipped to every visitor.

Assets:

- `public/images/logo.png`
- `public/images/hero.webp`
- `public/images/cabin-exterior.webp`
- `public/images/cabin-interior.webp`
- `public/images/cabin-interior-detail.webp`
- `public/images/waterfall.webp`

## Reference research

The requested Facebook page was opened, but Facebook returned a temporary access block to this browsing session, so the page's post copy could not be reliably extracted. The requested Google Form redirected to a Google Forms view URL that this environment could not fetch either.

To avoid inventing facts, the public listing for **Kanlungan Cabin at Malaya Campsite in Nasugbu, Batangas** was used only for factual cues that were accessible: up to two guests, a 22-hour stay, breakfast, unlimited Kapeng Barako, beddings/towels/toiletries, bonfire and games, a cooking area, pet-friendly policy, and outdoor activities such as horseback riding, river exploration, and farm-life experiences.

The booking interface uses the same general decision flow the references suggest—choose the stay and dates first, then provide contact details and special notes—but does not copy the exact form layout.


### Hero video
The homepage hero uses the supplied campsite video from `public/videos/malaya-hero.mp4`. It is muted, looping, inline, and uses `public/images/hero.webp` as its poster/fallback image. The uploaded 4K source was optimized to 1080p H.264 without audio for a lighter Vercel deployment.
