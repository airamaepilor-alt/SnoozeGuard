-- Replace sms_provider + sms_api_key columns with a simple sms_enabled toggle.
-- API keys are stored as Supabase Edge Function secrets, not in the database.

alter table public.admin_config
  drop column if exists sms_provider,
  drop column if exists sms_api_key,
  add column if not exists sms_enabled boolean not null default false;

-- Drop the old 8-param RPC (added in 20260417010000).
drop function if exists public.update_admin_config(int, int, int, jsonb, uuid, int, text, text);
-- Drop 6-param variant from earlier migration, if still present.
drop function if exists public.update_admin_config(int, int, int, jsonb, uuid, int);

create or replace function public.update_admin_config(
  p_yawn_threshold              int,
  p_head_movement_threshold     int,
  p_drowsiness_trigger_level    int,
  p_alert_map                   jsonb,
  p_updated_by                  uuid,
  p_score_reset_minutes         int     default 2,
  p_sms_enabled                 boolean default false
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
    sms_enabled               = p_sms_enabled,
    updated_at                = now(),
    updated_by                = p_updated_by
  where id = 1;
end;
$$;

revoke all on function public.update_admin_config from public;
grant execute on function public.update_admin_config(int, int, int, jsonb, uuid, int, boolean) to authenticated;
