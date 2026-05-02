-- Device-initiated pairing flow.
-- Instead of users typing device IDs, the IoT device sends a link request
-- containing the user's email. The user accepts or rejects in the app.

ALTER TABLE public.user_iot_devices
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('pending', 'accepted')),
  ADD COLUMN IF NOT EXISTS requested_email text;

-- RPC: authenticated user accepts a pending link request from a device.
CREATE OR REPLACE FUNCTION public.accept_device_link(p_device_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_iot_devices
  SET status = 'accepted'
  WHERE user_id = auth.uid()
    AND device_id = lower(trim(p_device_id))
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending link request found for this device';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_device_link(text) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_device_link(text) TO authenticated;
