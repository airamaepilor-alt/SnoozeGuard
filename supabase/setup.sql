-- ============================================================
-- SnoozeGuard — Full Supabase Setup SQL
-- Run this entire file in the Supabase SQL Editor.
-- All statements are idempotent (safe to re-run).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. PROFILES TABLE
--    Extend with email so we can display it without RLS issues.
--    (The actual auth email lives in auth.users — we mirror it here.)
-- ────────────────────────────────────────────────────────────

alter table profiles
  add column if not exists email text;

-- Backfill existing rows from auth.users
update profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

-- Allow any authenticated user to read other users' display name + email.
-- This is needed so the contact request card can show the driver's name/email.
-- Only non-sensitive display fields are exposed this way.
alter table profiles enable row level security;

drop policy if exists "Users read own profile" on profiles;
create policy "Users read own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Authenticated users read any profile" on profiles;
create policy "Authenticated users read any profile"
  on profiles for select
  using (auth.role() = 'authenticated');


-- ────────────────────────────────────────────────────────────
-- 2. EMERGENCY CONTACTS TABLE
-- ────────────────────────────────────────────────────────────

create table if not exists emergency_contacts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users not null,
  contact_user_id  uuid references auth.users,   -- set if contact is a registered user
  contact_name     text not null,
  contact_phone    text,
  contact_email    text,
  status           text not null default 'accepted', -- 'pending' | 'accepted'
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (user_id)
);

-- Add status column if table already existed without it
alter table emergency_contacts
  add column if not exists status text not null default 'accepted';

-- Add contact_user_id column if table already existed without it
alter table emergency_contacts
  add column if not exists contact_user_id uuid references auth.users;

-- RLS
alter table emergency_contacts enable row level security;

-- Driver manages their own emergency contact record
drop policy if exists "Driver manages own EC" on emergency_contacts;
create policy "Driver manages own EC"
  on emergency_contacts for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Contact can view requests addressed to them (to accept/decline)
drop policy if exists "Contact views their requests" on emergency_contacts;
create policy "Contact views their requests"
  on emergency_contacts for select
  using (auth.uid() = contact_user_id);

-- Contact can accept a pending request (update status)
drop policy if exists "Contact accepts request" on emergency_contacts;
create policy "Contact accepts request"
  on emergency_contacts for update
  using (auth.uid() = contact_user_id);

-- Contact can decline a request (delete row)
drop policy if exists "Contact declines request" on emergency_contacts;
create policy "Contact declines request"
  on emergency_contacts for delete
  using (auth.uid() = contact_user_id);


-- ────────────────────────────────────────────────────────────
-- 3. PUSH TOKENS TABLE
-- ────────────────────────────────────────────────────────────

create table if not exists push_tokens (
  user_id          uuid references auth.users primary key,
  expo_push_token  text not null,
  updated_at       timestamptz default now()
);

alter table push_tokens enable row level security;

drop policy if exists "Users manage own push token" on push_tokens;
create policy "Users manage own push token"
  on push_tokens for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Allow reading another user's push token so the app can send notifications
-- (only the token is exposed — no personal data)
drop policy if exists "Authenticated users read push tokens" on push_tokens;
create policy "Authenticated users read push tokens"
  on push_tokens for select
  using (auth.role() = 'authenticated');


-- ────────────────────────────────────────────────────────────
-- 4. EMERGENCY ALERT EVENTS TABLE
-- ────────────────────────────────────────────────────────────

create table if not exists emergency_alert_events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users not null,
  session_id       uuid,
  location_lat     double precision,
  location_lng     double precision,
  status           text default 'active',  -- 'active' | 'alerted' | 'dismissed'
  created_at       timestamptz default now(),
  acknowledged_at  timestamptz,            -- set when driver taps "I'm alert"
  dismissed_at     timestamptz             -- set when contact marks resolved
);

-- Add columns if table already existed without them
alter table emergency_alert_events
  add column if not exists acknowledged_at timestamptz;

alter table emergency_alert_events
  add column if not exists dismissed_at timestamptz;

alter table emergency_alert_events
  add column if not exists session_id uuid;

-- RLS
alter table emergency_alert_events enable row level security;

-- Driver inserts and manages their own alerts
drop policy if exists "Driver inserts own alerts" on emergency_alert_events;
create policy "Driver inserts own alerts"
  on emergency_alert_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "Driver reads own alerts" on emergency_alert_events;
create policy "Driver reads own alerts"
  on emergency_alert_events for select
  using (auth.uid() = user_id);

drop policy if exists "Driver updates own alerts" on emergency_alert_events;
create policy "Driver updates own alerts"
  on emergency_alert_events for update
  using (auth.uid() = user_id);

-- Emergency contact can read alerts for drivers they are linked to (accepted only)
drop policy if exists "Contact reads driver alerts" on emergency_alert_events;
create policy "Contact reads driver alerts"
  on emergency_alert_events for select
  using (
    exists (
      select 1 from emergency_contacts ec
      where ec.user_id = emergency_alert_events.user_id
        and ec.contact_user_id = auth.uid()
        and ec.status = 'accepted'
    )
  );

-- Emergency contact can update alert status (mark resolved)
drop policy if exists "Contact updates driver alerts" on emergency_alert_events;
create policy "Contact updates driver alerts"
  on emergency_alert_events for update
  using (
    exists (
      select 1 from emergency_contacts ec
      where ec.user_id = emergency_alert_events.user_id
        and ec.contact_user_id = auth.uid()
        and ec.status = 'accepted'
    )
  );


-- ────────────────────────────────────────────────────────────
-- 5. EMAIL LOOKUP FUNCTION
--    Allows the app to find a user's ID by email without
--    hitting RLS restrictions on the profiles table.
--    SECURITY DEFINER = runs with postgres privileges.
-- ────────────────────────────────────────────────────────────

create or replace function get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
stable
as $$
  select id
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;
$$;

-- Restrict to authenticated users only
revoke all on function get_user_id_by_email(text) from public;
grant execute on function get_user_id_by_email(text) to authenticated;


-- ────────────────────────────────────────────────────────────
-- 6. AUTO-LINK CONTACT USER IDs FOR EXISTING ROWS
--    If any emergency_contacts rows were saved before the
--    email-lookup function existed, backfill contact_user_id.
-- ────────────────────────────────────────────────────────────

update emergency_contacts ec
set contact_user_id = u.id
from auth.users u
where lower(u.email) = lower(ec.contact_email)
  and ec.contact_user_id is null
  and ec.contact_email is not null;


-- ────────────────────────────────────────────────────────────
-- Done.
-- ────────────────────────────────────────────────────────────
