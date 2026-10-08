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
  alter table public.bookings
    add constraint bookings_confirmed_no_overlap
    exclude using gist (
      accommodation_id with =,
      daterange(check_in, check_out, '[)') with &&
    ) where (status = 'confirmed');
exception
  when duplicate_object then null;
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
  update public.support_conversations set updated_at = now() where id = new.conversation_id;
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

drop policy if exists "public create pending bookings" on public.bookings;
create policy "public create pending bookings" on public.bookings
for insert to anon, authenticated
with check (status = 'pending');

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
  update public.support_conversations
  set visitor_name = nullif(trim(p_visitor_name), ''),
      visitor_email = nullif(trim(p_visitor_email), ''),
      visitor_phone = nullif(trim(p_visitor_phone), '')
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
declare new_id uuid;
begin
  if p_sender not in ('visitor', 'bot') then raise exception 'Invalid visitor sender'; end if;
  if length(trim(p_text)) < 1 or length(trim(p_text)) > 2000 then raise exception 'Invalid message length'; end if;
  if not exists (
    select 1 from public.support_conversations
    where id = p_conversation_id and visitor_token = p_visitor_token and status = 'open'
  ) then raise exception 'Conversation not found'; end if;
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
  update public.support_conversations
  set mode = p_mode
  where id = p_conversation_id and visitor_token = p_visitor_token and status = 'open';
  if not found then raise exception 'Conversation not found'; end if;
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
revoke all on function public.get_support_messages(uuid, text) from public;
grant execute on function public.create_support_conversation(text) to anon, authenticated;
grant execute on function public.get_support_state(uuid, text) to anon, authenticated;
grant execute on function public.update_support_visitor(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.add_support_message(uuid, text, text, text) to anon, authenticated;
grant execute on function public.set_support_mode(uuid, text, text) to anon, authenticated;
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
  add column if not exists receipt_last_error text;

create table if not exists public.site_reviews (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  rating smallint not null check (rating between 1 and 5),
  review_text text not null check (char_length(trim(review_text)) between 1 and 2000),
  photo_data text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_reviews
  add column if not exists photo_data text;

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
create policy "public submit published reviews" on public.site_reviews
for insert to anon, authenticated
with check (published = true);

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
-- Reviews are stored as plain text and the frontend renders them as text only.
