-- SnoozeGuard initial schema (run via Supabase CLI or SQL editor)

create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'driver' check (role in ('driver', 'super_admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Driving sessions
create table public.driving_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  external_session_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  device_type text not null check (device_type in ('mobile', 'web', 'iot')),
  sync_status text not null default 'synced' check (sync_status in ('local', 'synced'))
);

create index driving_sessions_user_started_idx
  on public.driving_sessions (user_id, started_at desc);

alter table public.driving_sessions enable row level security;

create policy "sessions_select_own"
  on public.driving_sessions for select
  using (auth.uid() = user_id);

create policy "sessions_insert_own"
  on public.driving_sessions for insert
  with check (auth.uid() = user_id);

create policy "sessions_update_own"
  on public.driving_sessions for update
  using (auth.uid() = user_id);

-- Telemetry samples (batched or streaming)
create table public.session_telemetry (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.driving_sessions (id) on delete cascade,
  recorded_at timestamptz not null,
  drowsiness_level numeric not null check (drowsiness_level >= 0 and drowsiness_level <= 10),
  yawn_count_delta int not null default 0,
  head_event_count_delta int not null default 0,
  sudden_brake boolean not null default false,
  source text
);

create index session_telemetry_session_time_idx
  on public.session_telemetry (session_id, recorded_at desc);

alter table public.session_telemetry enable row level security;

create policy "telemetry_select_via_session"
  on public.session_telemetry for select
  using (
    exists (
      select 1 from public.driving_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "telemetry_insert_via_session"
  on public.session_telemetry for insert
  with check (
    exists (
      select 1 from public.driving_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- Singleton admin configuration
create table public.admin_config (
  id int primary key check (id = 1),
  yawn_threshold int not null default 3,
  head_movement_threshold int not null default 20,
  drowsiness_trigger_level int not null default 6,
  alert_map jsonb not null default '{
    "6": {"label": "Soft alarm", "actions": ["sound", "voice"]},
    "7": {"label": "Strong alert", "actions": ["sound", "vibration"]},
    "8": {"label": "Critical", "actions": ["flashlight", "alarm", "iot_led"]}
  }'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

insert into public.admin_config (id) values (1);

alter table public.admin_config enable row level security;

create policy "admin_config_select_authenticated"
  on public.admin_config for select
  to authenticated
  using (true);

create policy "admin_config_update_super_admin"
  on public.admin_config for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  );

-- New auth users get a profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'driver'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
