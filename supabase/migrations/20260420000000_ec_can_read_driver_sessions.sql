-- Allow emergency contacts to read driving sessions of drivers they protect.
-- Without this, the EC web dashboard always shows "Standby" because RLS
-- blocks cross-user reads on driving_sessions.

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
