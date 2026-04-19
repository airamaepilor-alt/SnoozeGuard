-- Fix: the previous policy queried auth.users which is not accessible to the
-- authenticated role, causing "permission denied for table users" on every
-- driving_sessions query. Replace with auth.email() which reads from the JWT.

drop policy if exists "sessions_select_as_emergency_contact" on public.driving_sessions;

create policy "sessions_select_as_emergency_contact"
  on public.driving_sessions for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.emergency_contacts ec
      where ec.user_id = driving_sessions.user_id
        and (
          ec.contact_user_id = auth.uid()
          or lower(ec.contact_email) = lower(auth.email())
        )
    )
  );
