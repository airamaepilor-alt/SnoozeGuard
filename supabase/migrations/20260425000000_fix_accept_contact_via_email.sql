-- Fix RLS policy for accepting contact requests when contact_user_id is NULL (pre-registration case)
-- The previous policy only allowed updates via contact_user_id match, failing for email-only contacts

drop policy if exists "Contact accepts request" on emergency_contacts;
create policy "Contact accepts request"
  on emergency_contacts for update
  using (
    auth.uid() = contact_user_id 
    OR (contact_user_id IS NULL AND lower(contact_email) = lower(auth.email()))
  );
