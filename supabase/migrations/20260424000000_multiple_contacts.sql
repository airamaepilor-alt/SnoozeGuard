-- Multiple emergency contacts support
-- Run in Supabase SQL editor (Dashboard → SQL editor → New query)

-- 1. Add is_active column
ALTER TABLE public.emergency_contacts
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Drop the old single-contact-per-user unique constraint
ALTER TABLE public.emergency_contacts
  DROP CONSTRAINT IF EXISTS emergency_contacts_user_id_key;

-- 3. Partial unique index: at most one active contact per driver
CREATE UNIQUE INDEX IF NOT EXISTS emergency_contacts_one_active_per_user
  ON public.emergency_contacts (user_id) WHERE (is_active = TRUE);

-- 4. Backfill: mark the first (oldest) contact as active for each driver
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC NULLS LAST) AS rn
  FROM public.emergency_contacts
)
UPDATE public.emergency_contacts
  SET is_active = TRUE
  WHERE id IN (SELECT id FROM ranked WHERE rn = 1);

-- 5. RLS: let contacts read rows that match their email (for drivers who added
--    them before they had an account, where contact_user_id is still NULL).
DROP POLICY IF EXISTS "Contact views by email" ON public.emergency_contacts;
CREATE POLICY "Contact views by email"
  ON public.emergency_contacts FOR SELECT
  USING (lower(contact_email) = lower(auth.email()));
