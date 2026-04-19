-- Add head_tilt_delta to cloud session_telemetry.
-- Mobile has tracked this locally since the additive SQLite migration but the
-- column was never added to the cloud schema, so tilts were silently dropped
-- on sync and never shown on the web dashboard.

alter table public.session_telemetry
  add column if not exists head_tilt_delta int not null default 0;
