-- ─── 1. accept_contact_request_by_token: also populate contact_user_id ──────
-- When a guardian accepts via the magic link, look up their SnoozeGuard user_id
-- by matching their email in the profiles table and store it in contact_user_id.
CREATE OR REPLACE FUNCTION public.accept_contact_request_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row          public.emergency_contacts%ROWTYPE;
  v_active_count int;
  v_user_id      uuid;
BEGIN
  SELECT * INTO v_row
  FROM public.emergency_contacts
  WHERE accept_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid link. It may not exist or was already used.');
  END IF;

  IF v_row.token_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This link has expired (valid for 7 days). Ask the driver to resend the request.');
  END IF;

  IF v_row.status = 'accepted' THEN
    RETURN jsonb_build_object('success', true, 'already_accepted', true);
  END IF;

  -- Look up user_id from profiles by the contact's email (null if not a SG user)
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE lower(email) = lower(v_row.contact_email)
  LIMIT 1;

  -- Count current active guardians for this driver to respect the 3-limit
  SELECT COUNT(*) INTO v_active_count
  FROM public.emergency_contacts
  WHERE user_id = v_row.user_id AND is_active = true;

  UPDATE public.emergency_contacts
     SET status          = 'accepted',
         is_active       = (v_active_count < 3),
         contact_user_id = COALESCE(v_user_id, v_row.contact_user_id)
   WHERE accept_token = p_token;

  RETURN jsonb_build_object('success', true, 'already_accepted', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_contact_request_by_token(uuid) TO anon;

-- ─── 2. resolve_alert_by_id: anon-accessible "Mark as Resolved" ──────────────
-- Called from the public AlertViewPage. Secured by alert UUID being non-guessable.
CREATE OR REPLACE FUNCTION public.resolve_alert_by_id(p_alert_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.emergency_alert_events
     SET status       = 'dismissed',
         dismissed_at = now()
   WHERE id     = p_alert_id
     AND status != 'dismissed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_resolved', true);
  END IF;

  RETURN jsonb_build_object('success', true, 'already_resolved', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_alert_by_id(uuid) TO anon;

-- ─── 3. Backfill contact_user_id for existing accepted contacts ───────────────
UPDATE public.emergency_contacts ec
   SET contact_user_id = p.id
  FROM public.profiles p
 WHERE ec.contact_email IS NOT NULL
   AND lower(ec.contact_email) = lower(p.email)
   AND ec.contact_user_id IS NULL;
