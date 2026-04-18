-- Add score_reset_minutes to admin_config so super admins can control how long
-- after a level-10 idle period before drowsiness accumulators reset (default 2).

alter table public.admin_config
  add column if not exists score_reset_minutes int not null default 2;

-- Replace update_admin_config with a new signature that includes the new param.
-- The old 5-arg version is dropped first so the grant can target the new one cleanly.
drop function if exists public.update_admin_config(int, int, int, jsonb, uuid);

create or replace function public.update_admin_config(
  p_yawn_threshold              int,
  p_head_movement_threshold     int,
  p_drowsiness_trigger_level    int,
  p_alert_map                   jsonb,
  p_updated_by                  uuid,
  p_score_reset_minutes         int default 2
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  ) then
    raise exception 'Access denied: super_admin role required';
  end if;

  update public.admin_config
  set
    yawn_threshold            = p_yawn_threshold,
    head_movement_threshold   = p_head_movement_threshold,
    drowsiness_trigger_level  = p_drowsiness_trigger_level,
    alert_map                 = p_alert_map,
    score_reset_minutes       = p_score_reset_minutes,
    updated_at                = now(),
    updated_by                = p_updated_by
  where id = 1;
end;
$$;

revoke all on function public.update_admin_config from public;
grant execute on function public.update_admin_config(int, int, int, jsonb, uuid, int) to authenticated;
