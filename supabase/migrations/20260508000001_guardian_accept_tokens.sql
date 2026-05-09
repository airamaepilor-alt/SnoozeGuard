-- Migration: Token-based guardian acceptance (email / SMS magic link)
-- Allows emergency contacts to accept/decline without a SnoozeGuard account.

-- ─── 1. Add token columns ──────────────────────────────────────────────────────

ALTER TABLE public.emergency_contacts
  ADD COLUMN IF NOT EXISTS accept_token     uuid        NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');

-- Unique index so we can look up by token quickly
CREATE UNIQUE INDEX IF NOT EXISTS emergency_contacts_accept_token_idx
  ON public.emergency_contacts (accept_token);

-- ─── 2. RPC: look up a request by token (read-only, returns only safe fields) ──

CREATE OR REPLACE FUNCTION public.get_contact_request_by_token(p_token uuid)
RETURNS TABLE(
  id          uuid,
  driver_name text,
  status      text,
  expired     boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.id,
    COALESCE(p.full_name, ec.contact_name) AS driver_name,
    ec.status,
    (ec.token_expires_at < now())           AS expired
  FROM public.emergency_contacts ec
  LEFT JOIN public.profiles p ON p.id = ec.user_id
  WHERE ec.accept_token = p_token
  LIMIT 1;
END;
$$;

-- ─── 3. RPC: accept by token ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_contact_request_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.emergency_contacts%ROWTYPE;
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

  IF v_row.status = 'rejected' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'You previously declined this request. Ask the driver to send a new invitation.'
    );
  END IF;

  UPDATE public.emergency_contacts
     SET status = 'accepted'
   WHERE accept_token = p_token;

  RETURN jsonb_build_object('success', true, 'already_accepted', false);
END;
$$;

-- ─── 4. RPC: decline by token ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.decline_contact_request_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.emergency_contacts%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.emergency_contacts
  WHERE accept_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid link.');
  END IF;

  IF v_row.token_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This link has expired.');
  END IF;

  IF v_row.status IN ('accepted', 'rejected') THEN
    RETURN jsonb_build_object('success', true, 'already_resolved', true, 'current_status', v_row.status);
  END IF;

  UPDATE public.emergency_contacts
     SET status = 'rejected'
   WHERE accept_token = p_token;

  RETURN jsonb_build_object('success', true, 'already_resolved', false);
END;
$$;

-- ─── 5. Grant to anon so the public accept page works without login ────────────

GRANT EXECUTE ON FUNCTION public.get_contact_request_by_token(uuid)    TO anon;
GRANT EXECUTE ON FUNCTION public.accept_contact_request_by_token(uuid)  TO anon;
GRANT EXECUTE ON FUNCTION public.decline_contact_request_by_token(uuid) TO anon;
