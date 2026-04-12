-- Fix admin_config RLS: the original UPDATE policy had no WITH CHECK clause.
-- PostgreSQL defaults WITH CHECK to the USING expression, but Supabase sometimes
-- rejects updates when the new row doesn't pass its own USING check after mutation.
-- Adding an explicit WITH CHECK (true) allows super_admins to set any valid values.

drop policy if exists "admin_config_update_super_admin" on public.admin_config;

create policy "admin_config_update_super_admin"
  on public.admin_config for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  )
  with check (true);
