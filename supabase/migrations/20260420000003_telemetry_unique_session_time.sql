-- Prevent duplicate telemetry rows that inflate yawn/nod/tilt counts on the
-- web dashboard. Both mobile and web sync could re-insert rows if the app
-- crashed after the Supabase INSERT but before marking remote_synced=1 locally.
-- Without this constraint, each sync retry added a fresh duplicate row.

-- Step 1: remove existing duplicates, keeping the row with the lowest id.
delete from public.session_telemetry
where id not in (
  select min(id)
  from public.session_telemetry
  group by session_id, recorded_at
);

-- Step 2: add the unique constraint so future syncs are idempotent.
alter table public.session_telemetry
  add constraint session_telemetry_session_recorded_at_key
  unique (session_id, recorded_at);
