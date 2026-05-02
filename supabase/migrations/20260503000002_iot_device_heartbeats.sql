-- Raw device ping log — written by the service backend on every MQTT ping received.
-- Exists independently of user pairing so pair_iot_device can verify the device
-- is real and online before completing the pairing.

CREATE TABLE IF NOT EXISTS public.iot_device_heartbeats (
  device_id  TEXT PRIMARY KEY,
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.iot_device_heartbeats ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read (needed by the SECURITY DEFINER RPC internally,
-- and useful for debug queries). Service role bypasses RLS for writes.
DROP POLICY IF EXISTS "heartbeats_read" ON public.iot_device_heartbeats;
CREATE POLICY "heartbeats_read" ON public.iot_device_heartbeats
  FOR SELECT USING (auth.role() = 'authenticated');


-- Update pair_iot_device to require a recent heartbeat before pairing.
-- Device pings every 5 s; 60 s window gives plenty of margin for boot time.
CREATE OR REPLACE FUNCTION public.pair_iot_device(p_device_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Verify the device is online (pinged within the last 60 seconds)
  IF NOT EXISTS (
    SELECT 1 FROM public.iot_device_heartbeats
    WHERE device_id = lower(trim(p_device_id))
      AND last_seen > now() - interval '60 seconds'
  ) THEN
    RAISE EXCEPTION 'Device not found or offline. Make sure your device is powered on and connected to WiFi.';
  END IF;

  -- 2. Reject if the device is already registered to a different user
  IF EXISTS (
    SELECT 1 FROM public.user_iot_devices
    WHERE device_id = lower(trim(p_device_id))
      AND user_id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'Device is already registered to another account';
  END IF;

  -- 3. Upsert for the calling user
  INSERT INTO public.user_iot_devices (user_id, device_id, last_seen, created_at)
  VALUES (auth.uid(), lower(trim(p_device_id)), now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET device_id = lower(trim(p_device_id)),
        last_seen = now();
END;
$$;

REVOKE ALL ON FUNCTION public.pair_iot_device(text) FROM public;
GRANT EXECUTE ON FUNCTION public.pair_iot_device(text) TO authenticated;
