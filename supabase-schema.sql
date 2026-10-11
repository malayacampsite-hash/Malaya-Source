-- MALAYA CAMPSITE — SUPABASE DATABASE
-- Run this entire file in Supabase SQL Editor.
-- Safe for a new project. Several ALTER statements are included so the file can also
-- upgrade the earlier Malaya schema without dropping live data.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_malaya_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

grant execute on function public.is_malaya_admin() to anon, authenticated;

create table if not exists public.accommodation_inventory (
  id text primary key,
  name text not null,
  short_description text not null default '',
  capacity integer not null check (capacity between 1 and 50),
  price_label text not null default 'Contact for current rates',
  features text[] not null default '{}',
  image text not null default '/images/hero.webp',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.accommodation_inventory
  add column if not exists short_description text not null default '',
  add column if not exists price_label text not null default 'Contact for current rates',
  add column if not exists features text[] not null default '{}',
  add column if not exists image text not null default '/images/hero.webp',
  add column if not exists sort_order integer not null default 0;

insert into public.accommodation_inventory(id, name, short_description, capacity, price_label, features, image, sort_order)
values (
  'kanlungan-cabin',
  'Kanlungan Cabin',
  'A private bamboo cabin for a quieter stay close to nature.',
  2,
  'Rate confirmed with your booking request',
  array['2 guests', '22-hour stay', 'Breakfast', 'Kapeng Barako', 'Private cabin'],
  '/images/cabin-interior.webp',
  1
)
on conflict (id) do nothing;

alter table public.accommodation_inventory enable row level security;

create or replace function public.accommodation_accepts_guests(p_accommodation_id text, p_guests integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.accommodation_inventory
    where id = p_accommodation_id and is_active and capacity >= p_guests
  );
$$;

revoke all on function public.accommodation_accepts_guests(text, integer) from public;
grant execute on function public.accommodation_accepts_guests(text, integer) to anon, authenticated;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  accommodation_id text not null,
  check_in date not null,
  check_out date not null,
  guests integer not null check (guests between 1 and 50),
  full_name text not null,
  email text not null,
  phone text not null,
  preferred_arrival text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in)
);

alter table public.bookings add column if not exists preferred_arrival text;
alter table public.bookings add column if not exists updated_at timestamptz not null default now();

create index if not exists bookings_created_at_idx on public.bookings(created_at desc);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_check_in_idx on public.bookings(check_in);

-- Only one confirmed reservation can occupy a stay on overlapping dates.
-- Pending requests may overlap because they still require staff confirmation.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_confirmed_no_overlap'
  ) then
    alter table public.bookings
      add constraint bookings_confirmed_no_overlap
      exclude using gist (
        accommodation_id with =,
        daterange(check_in, check_out, '[)') with &&
      ) where (status = 'confirmed');
  end if;
exception
  -- Older runs may have created the backing index before the schema completed.
  when duplicate_object or duplicate_table then null;
end $$;

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_token text not null unique,
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  mode text not null default 'bot' check (mode in ('bot', 'staff')),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_conversations_updated_at_idx on public.support_conversations(updated_at desc);
create index if not exists support_conversations_status_idx on public.support_conversations(status);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender text not null check (sender in ('visitor', 'bot', 'staff')),
  text text not null check (char_length(trim(text)) between 1 and 2000),
  created_at timestamptz not null default now(),
  admin_name text
);

create index if not exists support_messages_conversation_idx on public.support_messages(conversation_id, created_at);

-- Staff chat uses authenticated Postgres Changes subscriptions. Guest chat stays on
-- token-checked RPCs so visitor tokens never need to be exposed as Realtime claims.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_conversations'
  ) then
    execute 'alter publication supabase_realtime add table public.support_conversations';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.support_messages';
  end if;
end $$;

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings(key, value)
values ('daily_message', to_jsonb('A slower stay, a bamboo cabin, and more time outdoors.'::text))
on conflict (key) do nothing;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at before update on public.bookings
for each row execute function public.touch_updated_at();

drop trigger if exists support_conversations_touch_updated_at on public.support_conversations;
create trigger support_conversations_touch_updated_at before update on public.support_conversations
for each row execute function public.touch_updated_at();

drop trigger if exists site_settings_touch_updated_at on public.site_settings;
create trigger site_settings_touch_updated_at before update on public.site_settings
for each row execute function public.touch_updated_at();

create or replace function public.touch_support_conversation()
returns trigger
language plpgsql
as $$
begin
  update public.support_conversations
  set updated_at = now(),
      mode = case when new.sender = 'staff' then 'staff' else mode end
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists support_message_touch_conversation on public.support_messages;
create trigger support_message_touch_conversation after insert on public.support_messages
for each row execute function public.touch_support_conversation();

alter table public.admin_users enable row level security;
alter table public.bookings enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "admins read admin users" on public.admin_users;
create policy "admins read admin users" on public.admin_users
for select to authenticated using (public.is_malaya_admin());

drop policy if exists "public read active accommodation inventory" on public.accommodation_inventory;
create policy "public read active accommodation inventory" on public.accommodation_inventory
for select to anon, authenticated using (is_active = true);

drop policy if exists "admins manage accommodation inventory" on public.accommodation_inventory;
create policy "admins manage accommodation inventory" on public.accommodation_inventory
for all to authenticated using (public.is_malaya_admin()) with check (public.is_malaya_admin());

drop policy if exists "public create pending bookings" on public.bookings;
create policy "public create pending bookings" on public.bookings
for insert to anon, authenticated
with check (
  status = 'pending'
  and public.accommodation_accepts_guests(accommodation_id, guests)
  and check_in >= (now() at time zone 'Asia/Manila')::date
  and char_length(trim(booking_reference)) between 1 and 40
  and full_name = trim(full_name)
  and char_length(trim(full_name)) between 1 and 120
  and email = trim(email)
  and char_length(trim(email)) between 3 and 254
  and lower(trim(email)) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  and phone = trim(phone)
  and char_length(trim(phone)) between 7 and 40
  and phone ~ '^[+]?[0-9 ()().-]+$'
  and char_length(regexp_replace(phone, '[^0-9]', '', 'g')) between 7 and 15
  and (preferred_arrival is null or preferred_arrival ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  and (notes is null or char_length(notes) <= 2000)
);

drop policy if exists "admins read bookings" on public.bookings;
create policy "admins read bookings" on public.bookings
for select to authenticated using (public.is_malaya_admin());

drop policy if exists "admins update bookings" on public.bookings;
create policy "admins update bookings" on public.bookings
for update to authenticated using (public.is_malaya_admin()) with check (public.is_malaya_admin());

drop policy if exists "public read daily setting" on public.site_settings;
create policy "public read daily setting" on public.site_settings
for select to anon, authenticated using (key = 'daily_message');

drop policy if exists "admins manage settings" on public.site_settings;
create policy "admins manage settings" on public.site_settings
for all to authenticated using (public.is_malaya_admin()) with check (public.is_malaya_admin());

-- Visitor-facing support operations are RPC-based so the visitor token is checked server-side.
create or replace function public.create_support_conversation(p_visitor_token text)
returns table(id uuid, visitor_token text)
language plpgsql
security definer
set search_path = public
as $$
declare new_conversation_id uuid;
begin
  if p_visitor_token is null or length(p_visitor_token) < 20 then raise exception 'Invalid visitor token'; end if;
  insert into public.support_conversations(visitor_token) values (p_visitor_token)
  returning support_conversations.id into new_conversation_id;
  insert into public.support_messages(conversation_id, sender, text)
  values (new_conversation_id, 'bot', 'Hello. I can help with the cabin, the stay, booking questions, and getting a staff member into the conversation.');
  return query select new_conversation_id, p_visitor_token;
end;
$$;

create or replace function public.update_support_visitor(
  p_conversation_id uuid,
  p_visitor_token text,
  p_visitor_name text,
  p_visitor_email text,
  p_visitor_phone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(trim(coalesce(p_visitor_name, ''))) not between 1 and 120 then
    raise exception 'Please enter your name';
  end if;
  if char_length(trim(coalesce(p_visitor_email, ''))) not between 3 and 254
    or lower(trim(coalesce(p_visitor_email, ''))) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Please enter a valid email address';
  end if;
  if char_length(trim(coalesce(p_visitor_phone, ''))) not between 7 and 40
    or trim(coalesce(p_visitor_phone, '')) !~ '^[+]?[0-9 ().-]+$'
    or char_length(regexp_replace(coalesce(p_visitor_phone, ''), '[^0-9]', '', 'g')) not between 7 and 15 then
    raise exception 'Please enter a valid phone number';
  end if;

  update public.support_conversations
  set visitor_name = nullif(trim(p_visitor_name), ''),
      visitor_email = lower(trim(p_visitor_email)),
      visitor_phone = trim(p_visitor_phone)
  where id = p_conversation_id and visitor_token = p_visitor_token and status = 'open';
  if not found then raise exception 'Conversation not found'; end if;
end;
$$;

create or replace function public.add_support_message(
  p_conversation_id uuid,
  p_visitor_token text,
  p_sender text,
  p_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  conversation_row public.support_conversations%rowtype;
begin
  if p_sender not in ('visitor', 'bot') then raise exception 'Invalid visitor sender'; end if;
  if length(trim(p_text)) < 1 or length(trim(p_text)) > 2000 then raise exception 'Invalid message length'; end if;
  select * into conversation_row
  from public.support_conversations
  where id = p_conversation_id and visitor_token = p_visitor_token and status = 'open'
  for update;
  if not found then raise exception 'Conversation not found'; end if;
  if char_length(trim(coalesce(conversation_row.visitor_name, ''))) not between 1 and 120
    or char_length(trim(coalesce(conversation_row.visitor_email, ''))) not between 3 and 254
    or lower(trim(coalesce(conversation_row.visitor_email, ''))) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or char_length(trim(coalesce(conversation_row.visitor_phone, ''))) not between 7 and 40
    or trim(coalesce(conversation_row.visitor_phone, '')) !~ '^[+]?[0-9 ().-]+$'
    or char_length(regexp_replace(coalesce(conversation_row.visitor_phone, ''), '[^0-9]', '', 'g')) not between 7 and 15 then
    raise exception 'Add a valid name, email, and phone number before chatting';
  end if;
  if p_sender = 'bot' and exists (
    select 1 from public.support_messages
    where conversation_id = p_conversation_id and sender = 'staff'
  ) then
    return null;
  end if;
  insert into public.support_messages(conversation_id, sender, text)
  values (p_conversation_id, p_sender, trim(p_text))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.set_support_mode(
  p_conversation_id uuid,
  p_visitor_token text,
  p_mode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_mode not in ('bot', 'staff') then raise exception 'Invalid support mode'; end if;
  if not exists (
    select 1 from public.support_conversations
    where id = p_conversation_id
      and visitor_token = p_visitor_token
      and status = 'open'
      and char_length(trim(coalesce(visitor_name, ''))) between 1 and 120
      and char_length(trim(coalesce(visitor_email, ''))) between 3 and 254
      and lower(trim(coalesce(visitor_email, ''))) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      and char_length(trim(coalesce(visitor_phone, ''))) between 7 and 40
      and trim(coalesce(visitor_phone, '')) ~ '^[+]?[0-9 ().-]+$'
      and char_length(regexp_replace(coalesce(visitor_phone, ''), '[^0-9]', '', 'g')) between 7 and 15
  ) then
    raise exception 'Add a valid name, email, and phone number before requesting staff';
  end if;
  update public.support_conversations
  set mode = p_mode
  where id = p_conversation_id and visitor_token = p_visitor_token and status = 'open';
  if not found then raise exception 'Conversation not found'; end if;
end;
$$;

create or replace function public.send_support_staff_message(
  p_conversation_id uuid,
  p_text text,
  p_admin_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.is_malaya_admin() then raise exception 'Not authorized'; end if;
  if char_length(trim(coalesce(p_text, ''))) not between 1 and 2000 then
    raise exception 'Invalid message length';
  end if;
  if char_length(trim(coalesce(p_admin_name, ''))) > 120 then
    raise exception 'Invalid staff name';
  end if;

  perform 1 from public.support_conversations
  where id = p_conversation_id and status = 'open'
  for update;
  if not found then raise exception 'Conversation not found'; end if;

  insert into public.support_messages(conversation_id, sender, text, admin_name)
  values (p_conversation_id, 'staff', trim(p_text), nullif(trim(p_admin_name), ''))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.get_support_state(p_conversation_id uuid, p_visitor_token text)
returns table(mode text, status text, visitor_name text, visitor_email text, visitor_phone text)
language sql
security definer
set search_path = public
as $$
  select c.mode, c.status, c.visitor_name, c.visitor_email, c.visitor_phone
  from public.support_conversations c
  where c.id = p_conversation_id and c.visitor_token = p_visitor_token;
$$;

create or replace function public.get_support_messages(p_conversation_id uuid, p_visitor_token text)
returns table(id uuid, sender text, text text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select m.id, m.sender, m.text, m.created_at
  from public.support_messages m
  join public.support_conversations c on c.id = m.conversation_id
  where c.id = p_conversation_id and c.visitor_token = p_visitor_token
  order by m.created_at asc;
$$;

revoke all on function public.create_support_conversation(text) from public;
revoke all on function public.get_support_state(uuid, text) from public;
revoke all on function public.update_support_visitor(uuid, text, text, text, text) from public;
revoke all on function public.add_support_message(uuid, text, text, text) from public;
revoke all on function public.set_support_mode(uuid, text, text) from public;
revoke all on function public.send_support_staff_message(uuid, text, text) from public;
revoke all on function public.get_support_messages(uuid, text) from public;
grant execute on function public.create_support_conversation(text) to anon, authenticated;
grant execute on function public.get_support_state(uuid, text) to anon, authenticated;
grant execute on function public.update_support_visitor(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.add_support_message(uuid, text, text, text) to anon, authenticated;
grant execute on function public.set_support_mode(uuid, text, text) to anon, authenticated;
grant execute on function public.send_support_staff_message(uuid, text, text) to authenticated;
grant execute on function public.get_support_messages(uuid, text) to anon, authenticated;

grant execute on function public.get_support_state(uuid, text) to anon, authenticated;
grant execute on function public.update_support_visitor(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.add_support_message(uuid, text, text, text) to anon, authenticated;
grant execute on function public.set_support_mode(uuid, text, text) to anon, authenticated;
grant execute on function public.get_support_messages(uuid, text) to anon, authenticated;

drop policy if exists "admins read conversations" on public.support_conversations;
create policy "admins read conversations" on public.support_conversations
for select to authenticated using (public.is_malaya_admin());

drop policy if exists "admins update conversations" on public.support_conversations;
create policy "admins update conversations" on public.support_conversations
for update to authenticated using (public.is_malaya_admin()) with check (public.is_malaya_admin());

drop policy if exists "admins read messages" on public.support_messages;
create policy "admins read messages" on public.support_messages
for select to authenticated using (public.is_malaya_admin());

drop policy if exists "admins insert messages" on public.support_messages;
create policy "admins insert messages" on public.support_messages
for insert to authenticated
with check (public.is_malaya_admin() and sender = 'staff');

-- ============================================================
-- Reviews + Google automation metadata
-- ============================================================

alter table public.bookings
  add column if not exists sheet_row_number integer,
  add column if not exists sheet_synced_at timestamptz,
  add column if not exists sheet_sync_error text,
  add column if not exists receipt_sent_at timestamptz,
  add column if not exists receipt_processing_at timestamptz,
  add column if not exists receipt_last_error text,
  add column if not exists receipt_retry_requested_at timestamptz;

create table if not exists public.site_reviews (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  rating smallint not null check (rating between 1 and 5),
  review_text text not null check (char_length(trim(review_text)) between 1 and 2000),
  photo_data text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_reviews
  add column if not exists photo_data text;

alter table public.site_reviews
  alter column published set default false;

alter table public.site_reviews
  drop constraint if exists site_reviews_photo_data_valid;

alter table public.site_reviews
  add constraint site_reviews_photo_data_valid
  check (
    photo_data is null
    or (
      char_length(photo_data) between 100 and 1800000
      and photo_data ~ '^[A-Za-z0-9+/]+={0,2}$'
    )
  );

create index if not exists site_reviews_published_created_idx
  on public.site_reviews(published, created_at desc);

drop trigger if exists site_reviews_touch_updated_at on public.site_reviews;
create trigger site_reviews_touch_updated_at before update on public.site_reviews
for each row execute function public.touch_updated_at();

alter table public.site_reviews enable row level security;

drop policy if exists "public read published reviews" on public.site_reviews;
create policy "public read published reviews" on public.site_reviews
for select to anon, authenticated
using (published = true);

drop policy if exists "public submit published reviews" on public.site_reviews;
drop policy if exists "public submit unpublished reviews" on public.site_reviews;
create policy "public submit unpublished reviews" on public.site_reviews
for insert to anon, authenticated
with check (published = false);

drop policy if exists "admins read all reviews" on public.site_reviews;
create policy "admins read all reviews" on public.site_reviews
for select to authenticated
using (public.is_malaya_admin());

drop policy if exists "admins update reviews" on public.site_reviews;
create policy "admins update reviews" on public.site_reviews
for update to authenticated
using (public.is_malaya_admin())
with check (public.is_malaya_admin());

drop policy if exists "admins delete reviews" on public.site_reviews;
create policy "admins delete reviews" on public.site_reviews
for delete to authenticated
using (public.is_malaya_admin());

-- The visitor review flow deliberately does not require an account.
-- New reviews stay unpublished until a Malaya admin approves them.
-- Reviews are stored as plain text and the frontend renders them as text only.
