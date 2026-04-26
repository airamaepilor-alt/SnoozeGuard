-- ────────────────────────────────────────────────────────────
-- IoT device binding + alert commands (level 9/10 buzzer/LED)
-- ────────────────────────────────────────────────────────────

-- Per-user IoT device pairing + heartbeat tracking
create table if not exists public.user_iot_devices (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  device_id  text not null,
  last_seen  timestamptz,
  created_at timestamptz not null default now()
);
alter table public.user_iot_devices enable row level security;
drop policy if exists "iot_devices_own" on public.user_iot_devices;
create policy "iot_devices_own" on public.user_iot_devices
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Source of truth for active/dismissed IoT buzzer+LED commands
create table if not exists public.iot_alerts (
  id               uuid primary key default gen_random_uuid(),
  device_id        text not null,
  user_id          uuid not null references auth.users(id) on delete cascade,
  drowsiness_level int not null,
  status           text not null default 'active'
                   check (status in ('active', 'dismissed')),
  dismissed_by     text check (dismissed_by in ('driver', 'iot_button')),
  created_at       timestamptz not null default now(),
  dismissed_at     timestamptz
);
create index if not exists idx_iot_alerts_device
  on public.iot_alerts (device_id, status, created_at desc);
create index if not exists idx_iot_alerts_user
  on public.iot_alerts (user_id, created_at desc);
alter table public.iot_alerts enable row level security;
drop policy if exists "iot_alerts_own" on public.iot_alerts;
create policy "iot_alerts_own" on public.iot_alerts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
