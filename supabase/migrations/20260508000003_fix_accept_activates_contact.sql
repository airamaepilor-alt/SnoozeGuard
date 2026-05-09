-- Fix: accepting a guardian request now also sets is_active = true
-- (respecting the 3-active-guardian limit per driver).
-- Previously the RPC only set status = 'accepted' without activating.

CREATE OR REPLACE FUNCTION public.accept_contact_request_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row          public.emergency_contacts%ROWTYPE;
  v_active_count int;
BEGIN
  SELECT * INTO v_row
  FROM public.emergency_contacts
  WHERE accept_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Invalid link. It may not exist or was already used.'
    );
  END IF;

  IF v_row.token_expires_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'This link has expired (valid for 7 days). Ask the driver to resend the request.'
    );
  END IF;

  IF v_row.status = 'accepted' THEN
    RETURN jsonb_build_object('success', true, 'already_accepted', true);
  END IF;

  -- Count how many guardians the driver already has active
  SELECT COUNT(*) INTO v_active_count
  FROM public.emergency_contacts
  WHERE user_id = v_row.user_id AND is_active = true;

  UPDATE public.emergency_contacts
     SET status    = 'accepted',
         is_active = (v_active_count < 3)
   WHERE accept_token = p_token;

  RETURN jsonb_build_object('success', true, 'already_accepted', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_contact_request_by_token(uuid) TO anon;

-- Also backfill any existing accepted-but-inactive contacts so they become active.
-- This fixes contacts that were accepted before this migration.
UPDATE public.emergency_contacts
   SET is_active = true
 WHERE status    = 'accepted'
   AND is_active = false;
