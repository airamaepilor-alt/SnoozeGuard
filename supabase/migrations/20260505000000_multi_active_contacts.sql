-- Migration: Allow up to 3 active emergency contacts per driver
-- Previously: a partial unique index enforced exactly one active contact per user
-- Now: up to 3 active contacts are allowed per user; enforced by a BEFORE trigger

-- 1. Drop the old "one-active-per-user" partial unique index
DROP INDEX IF EXISTS emergency_contacts_one_active_per_user;

-- 2. Trigger function: raises an exception when a 4th active contact would be created
CREATE OR REPLACE FUNCTION public.check_max_active_emergency_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.is_active = TRUE AND (TG_OP = 'INSERT' OR OLD.is_active = FALSE) THEN
    IF (
      SELECT COUNT(*)
      FROM public.emergency_contacts
      WHERE user_id = NEW.user_id
        AND is_active = TRUE
        AND id <> NEW.id
    ) >= 3 THEN
      RAISE EXCEPTION 'max_active_exceeded'
        USING DETAIL = 'Maximum of 3 active guardians allowed per driver';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach trigger to emergency_contacts
DROP TRIGGER IF EXISTS trg_max_active_emergency_contacts ON public.emergency_contacts;
CREATE TRIGGER trg_max_active_emergency_contacts
  BEFORE INSERT OR UPDATE ON public.emergency_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_max_active_emergency_contacts();
