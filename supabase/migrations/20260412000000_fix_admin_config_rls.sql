-- Fix admin_config save: replace broken RLS update with a SECURITY DEFINER
-- function. The function verifies the caller is super_admin, then updates
-- admin_config directly (bypassing RLS), so no policy can block it.

-- 1. Keep the SELECT policy so anyone can read config (unchanged)
-- 2. Drop the broken UPDATE policy — the function replaces it
drop policy if exists "admin_config_update_super_admin" on public.admin_config;

-- 3. SECURITY DEFINER function — runs with postgres privileges, not the
--    caller's RLS context. Auth check is explicit inside the function body.
create or replace function public.update_admin_config(
  p_yawn_threshold              int,
  p_head_movement_threshold     int,
  p_drowsiness_trigger_level    int,
  p_alert_map                   jsonb,
  p_updated_by                  uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify the calling user is a super_admin
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
    updated_at                = now(),
    updated_by                = p_updated_by
  where id = 1;
end;
$$;

-- Allow any authenticated user to call it (the body checks super_admin)
revoke all on function public.update_admin_config from public;
grant execute on function public.update_admin_config(int, int, int, jsonb, uuid) to authenticated;
