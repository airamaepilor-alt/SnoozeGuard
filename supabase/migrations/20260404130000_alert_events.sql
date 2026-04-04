-- Discrete alert firings for analytics (NFR reliability / §12 “alert frequency”) and auditing.
-- Clients insert when the driver-facing alert UI is shown; optional link to Supabase session when known.

create table public.alert_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  driving_session_id uuid references public.driving_sessions (id) on delete set null,
  local_session_hint text,
  drowsiness_level numeric not null check (drowsiness_level >= 0 and drowsiness_level <= 10),
  trigger_level int not null,
  alert_label text,
  source text not null,
  created_at timestamptz not null default now()
);

create index alert_events_user_created_idx
  on public.alert_events (user_id, created_at desc);

alter table public.alert_events enable row level security;

create policy "alert_events_select_own"
  on public.alert_events for select
  to authenticated
  using (auth.uid() = user_id);

create policy "alert_events_insert_own"
  on public.alert_events for insert
  to authenticated
  with check (auth.uid() = user_id);

comment on table public.alert_events is
  'One row per time the in-app drowsiness alert surface was shown (web/mobile).';
