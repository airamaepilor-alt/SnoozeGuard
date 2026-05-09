-- ─── 1. decline_contact_request_by_token: DELETE instead of UPDATE ────────────
-- Guardian declined via magic link → remove the row entirely.
CREATE OR REPLACE FUNCTION public.decline_contact_request_by_token(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row public.emergency_contacts%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.emergency_contacts WHERE accept_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF now() > v_row.token_expires_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;
  DELETE FROM public.emergency_contacts WHERE accept_token = p_token;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.decline_contact_request_by_token(uuid) TO anon;

-- ─── 2. decline_guardian_request: authenticated guardian-initiated decline ────
-- Called from AlertsPage when a logged-in guardian clicks Decline.
-- Deletes the row if the caller is the contact (by user_id or email).
CREATE OR REPLACE FUNCTION public.decline_guardian_request(p_contact_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_email text;
BEGIN
  SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();

  -- Match by contact_user_id OR by email
  IF EXISTS (
    SELECT 1 FROM public.emergency_contacts
    WHERE id = p_contact_id
      AND (
        contact_user_id = auth.uid()
        OR (contact_email IS NOT NULL AND lower(contact_email) = lower(v_caller_email))
      )
  ) THEN
    DELETE FROM public.emergency_contacts WHERE id = p_contact_id;
    RETURN jsonb_build_object('success', true);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'not_found');
END;
$$;
GRANT EXECUTE ON FUNCTION public.decline_guardian_request(uuid) TO authenticated;

-- ─── 3. get_alert_view_data: public read for guest alert view page ─────────────
-- Returns minimal alert + driver info for the public /alert-view page.
-- Secured by alert UUID being non-guessable (no row-level auth needed).
CREATE OR REPLACE FUNCTION public.get_alert_view_data(p_alert_id uuid)
RETURNS TABLE(
  driver_name   text,
  location_lat  double precision,
  location_lng  double precision,
  status        text,
  created_at    timestamptz,
  driver_phone  text
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    p.full_name::text,
    e.location_lat,
    e.location_lng,
    e.status::text,
    e.created_at,
    p.phone::text
  FROM public.emergency_alert_events e
  JOIN public.profiles p ON p.id = e.user_id
  WHERE e.id = p_alert_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_alert_view_data(uuid) TO anon;
