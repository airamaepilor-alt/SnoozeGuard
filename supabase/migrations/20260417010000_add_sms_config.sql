-- Add SMS provider configuration to admin_config.
-- sms_provider: "semaphore" (Philippines), "twilio", or "textbelt" (free fallback)
-- sms_api_key:  API key string. For Twilio use format "ACCOUNT_SID:AUTH_TOKEN:FROM_NUMBER"

alter table public.admin_config
  add column if not exists sms_provider text not null default 'textbelt',
  add column if not exists sms_api_key  text not null default '';

-- Replace update_admin_config with new signature including SMS params.
drop function if exists public.update_admin_config(int, int, int, jsonb, uuid, int);

create or replace function public.update_admin_config(
  p_yawn_threshold              int,
  p_head_movement_threshold     int,
  p_drowsiness_trigger_level    int,
  p_alert_map                   jsonb,
  p_updated_by                  uuid,
  p_score_reset_minutes         int  default 2,
  p_sms_provider                text default 'textbelt',
  p_sms_api_key                 text default ''
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
    sms_provider              = p_sms_provider,
    sms_api_key               = p_sms_api_key,
    updated_at                = now(),
    updated_by                = p_updated_by
  where id = 1;
end;
$$;

revoke all on function public.update_admin_config from public;
grant execute on function public.update_admin_config(int, int, int, jsonb, uuid, int, text, text) to authenticated;
